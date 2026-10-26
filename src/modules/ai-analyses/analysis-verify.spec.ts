import { describe, expect, it } from 'vitest';
import type { AnalysisReference } from './ai-analysis.entity';
import {
  applyJudgements,
  attachReferences,
  judgeTargets,
  normalizeResult,
  searchTargets,
  verifySummary,
  type RawSummary,
  type RawSummaryItem,
  type SourceFeedback,
} from './analysis-verify';

const feedbacks = new Map<number, SourceFeedback>([
  [11, { id: 11, title: '알림이 늦어요', content: '절전 모드에서 알림이 10분 늦게 와요.\n다른 앱은 괜찮아요.' }],
  [12, { id: 12, title: '알림 지연', content: '아침 알림이 한참 뒤에 울려요.' }],
  [13, { id: 13, title: '디자인 좋아요', content: '화면이 깔끔해서 보기 편해요.' }],
]);

const item = (over: Partial<RawSummaryItem>): RawSummaryItem => ({ summary: '요약', type: 'bugSuspected', feedbackIds: [], evidence: [], ...over });
const raw = (over: Partial<RawSummary>): RawSummary => ({
  overview: '전체 요약',
  recurringIssues: [],
  improvementRequests: [],
  positiveOpinions: [],
  priorityChecks: [],
  ...over,
});
const ref = (url: string): Omit<AnalysisReference, 'id'> => ({ url, title: 't', citedText: 'c', query: 'q', checkedAt: '2026-10-26T00:00:00.000Z' });

describe('verifySummary', () => {
  it('입력에 없는 피드백 ID 는 지우고, 건수는 서버가 중복 없이 센다', () => {
    const r = verifySummary(raw({ priorityChecks: [item({ feedbackIds: [11, 11, 999, 12] })] }), feedbacks);
    expect(r.priorityChecks[0]).toMatchObject({ feedbackIds: [11, 12], mentionCount: 2 });
  });

  it('근거 ID 가 하나도 남지 않은 항목은 뺀다', () => {
    const r = verifySummary(raw({ improvementRequests: [item({ feedbackIds: [999] })] }), feedbacks);
    expect(r.improvementRequests).toEqual([]);
  });

  it('반복 문제는 서로 다른 피드백 2건 이상만 남긴다', () => {
    const r = verifySummary(
      raw({ recurringIssues: [item({ summary: '한 건', feedbackIds: [11, 11] }), item({ summary: '두 건', feedbackIds: [11, 12] })] }),
      feedbacks,
    );
    expect(r.recurringIssues.map((i) => i.summary)).toEqual(['두 건']);
  });

  it('근거 피드백 원문에 그대로 있는 인용만 남긴다 (공백·따옴표 차이는 허용)', () => {
    const r = verifySummary(
      raw({
        priorityChecks: [
          item({
            feedbackIds: [11],
            evidence: ['"절전 모드에서  알림이 10분 늦게 와요."', '알림이 아주 늦어요', '아침 알림이 한참 뒤에 울려요.', '알림'],
          }),
        ],
      }),
      feedbacks,
    );
    // 12번 원문은 이 항목의 근거가 아니므로 인용할 수 없다
    expect(r.priorityChecks[0].evidence).toEqual(['절전 모드에서 알림이 10분 늦게 와요.']);
  });

  it('묶음당 8개까지만 남긴다', () => {
    const many = Array.from({ length: 10 }, (_, i) => item({ summary: `${i}`, feedbackIds: [13], type: 'positive' }));
    expect(verifySummary(raw({ positiveOpinions: many }), feedbacks).positiveOpinions).toHaveLength(8);
  });
});

describe('참고자료 붙이기', () => {
  it('근거 피드백이 같은 항목은 한 번만 검색하고, 긍정 항목은 검색하지 않는다', () => {
    const r = verifySummary(
      raw({
        recurringIssues: [item({ summary: '반복', feedbackIds: [11, 12] })],
        priorityChecks: [item({ summary: '먼저', feedbackIds: [12, 11] }), item({ summary: '좋음', feedbackIds: [13], type: 'positive' })],
        positiveOpinions: [item({ feedbackIds: [13], type: 'positive' })],
      }),
      feedbacks,
    );
    const targets = searchTargets(r, 6);
    expect(targets).toHaveLength(1);
    expect(targets[0].query).toBe('먼저'); // 먼저 확인할 것의 문장으로 검색한다
    attachReferences(targets, [[ref('https://a.dev/x'), ref('https://b.dev/y')]]);
    expect(r.recurringIssues[0].references.map((x) => x.id)).toEqual(['R1', 'R2']);
    expect(r.priorityChecks[0].references.map((x) => x.id)).toEqual(['R1', 'R2']);
  });

  it('같은 URL 은 다른 항목에서도 같은 ID 를 쓴다', () => {
    const r = verifySummary(raw({ improvementRequests: [item({ feedbackIds: [11] }), item({ feedbackIds: [12] })] }), feedbacks);
    const targets = searchTargets(r, 6);
    attachReferences(targets, [[ref('https://a.dev/x')], [ref('https://c.dev'), ref('https://a.dev/x')]]);
    expect(r.improvementRequests[1].references.map((x) => x.id)).toEqual(['R2', 'R1']);
  });
});

describe('applyJudgements', () => {
  it('없는 key 와 그 항목에 붙지 않은 참고자료 ID 는 버리고, 긍정 의견에는 판단을 붙이지 않는다', () => {
    const r = verifySummary(
      raw({ priorityChecks: [item({ feedbackIds: [11] })], positiveOpinions: [item({ feedbackIds: [13], type: 'positive' })] }),
      feedbacks,
    );
    attachReferences(searchTargets(r, 6), [[ref('https://a.dev/x')]]);
    expect(judgeTargets(r).map((t) => t.key)).toEqual(['priorityChecks.0']);
    const base = { recommendedAction: ' 확인 ', rationale: '이유', confidence: 'medium', aiSuitability: 'unnecessary', aiReason: '설정 문제' } as const;
    applyJudgements(r, [
      { ...base, key: 'priorityChecks.0', referenceIds: ['R1', 'R9'] },
      { ...base, key: 'positiveOpinions.0', referenceIds: [] },
      { ...base, key: 'nope.3', referenceIds: [] },
    ]);
    expect(r.priorityChecks[0].action).toMatchObject({ recommendedAction: '확인', referenceIds: ['R1'] });
    expect(r.positiveOpinions[0].action).toBeNull();
  });
});

describe('normalizeResult', () => {
  it('예전 문자열 목록 버전을 지금 모양으로 바꾼다', () => {
    const r = normalizeResult({ recurringIssues: ['a'], improvementRequests: [], positiveOpinions: ['b'], priorityChecks: [] });
    expect(r.schemaVersion).toBe(1);
    expect(r.overview).toBe('');
    expect(r.recurringIssues[0]).toEqual({ summary: 'a', type: null, feedbackIds: [], mentionCount: 0, evidence: [], references: [], action: null });
  });
});
