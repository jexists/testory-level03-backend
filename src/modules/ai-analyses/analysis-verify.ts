import {
  ANALYSIS_SECTION_KEYS,
  type AnalysisAction,
  type AnalysisItem,
  type AnalysisItemType,
  type AnalysisReference,
  type AnalysisResult,
  type AnalysisSectionKey,
  type LegacyAnalysisResult,
} from './ai-analysis.entity';

/**
 * 모델 출력을 그대로 믿지 않고 입력 자료와 맞춰 보는 단계.
 * 없는 피드백 ID, 원문에 없는 인용, 검색되지 않은 참고자료 ID 를 여기서 걸러 낸다.
 */

export const MAX_ITEMS_PER_SECTION = 8;
/** 반복 문제로 보려면 서로 다른 피드백이 이만큼 있어야 한다 */
const MIN_RECURRING_MENTIONS = 2;
const MIN_EVIDENCE_CHARS = 4;

/** 모델이 요약 단계에서 내는 항목 (검증 전) */
export interface RawSummaryItem {
  summary: string;
  type: AnalysisItemType;
  feedbackIds: number[];
  evidence: string[];
}
export type RawSummary = { overview: string } & Record<AnalysisSectionKey, RawSummaryItem[]>;

/** 검증에 쓰는 피드백 원문 */
export interface SourceFeedback {
  id: number;
  title: string;
  content: string;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const unquote = (s: string) => s.replace(/^["'“”‘’「」『』\s]+|["'“”‘’「」『』\s]+$/g, '');

/** 요약 단계 출력에서 근거가 확인되는 것만 남긴다. 참고자료와 판단은 비어 있는 채로 돌려준다. */
export function verifySummary(raw: RawSummary, feedbacks: Map<number, SourceFeedback>): AnalysisResult {
  const section = (key: AnalysisSectionKey) => {
    const out: AnalysisItem[] = [];
    for (const r of raw[key] ?? []) {
      const ids = [...new Set(r.feedbackIds)].filter((id) => feedbacks.has(id));
      if (ids.length === 0) continue;
      if (key === 'recurringIssues' && ids.length < MIN_RECURRING_MENTIONS) continue;
      const sources = ids.map((id) => squash(`${feedbacks.get(id)!.title}\n${feedbacks.get(id)!.content}`));
      const evidence = [
        ...new Set(r.evidence.map((e) => unquote(squash(e))).filter((e) => e.length >= MIN_EVIDENCE_CHARS && sources.some((s) => s.includes(e)))),
      ];
      out.push({ summary: squash(r.summary), type: r.type, feedbackIds: ids, mentionCount: ids.length, evidence, references: [], action: null });
      if (out.length === MAX_ITEMS_PER_SECTION) break;
    }
    return out;
  };
  return {
    schemaVersion: 2,
    overview: squash(raw.overview),
    recurringIssues: section('recurringIssues'),
    improvementRequests: section('improvementRequests'),
    positiveOpinions: section('positiveOpinions'),
    priorityChecks: section('priorityChecks'),
  };
}

/** 조치를 제안할 항목인지 (긍정 의견은 조치 대상이 아니다) */
const needsAction = (key: AnalysisSectionKey, item: AnalysisItem) => key !== 'positiveOpinions' && item.type !== 'positive';

/** 웹 검색 한 번에 해당하는 묶음. 근거 피드백이 같은 항목은 한 번만 검색해 결과를 같이 쓴다. */
export interface SearchTarget {
  query: string;
  type: AnalysisItemType | null;
  items: AnalysisItem[];
}

/** 참고자료를 찾을 항목. 먼저 확인할 것 → 반복 문제 → 개선 요청 순으로 최대 max 묶음. */
export function searchTargets(result: AnalysisResult, max: number): SearchTarget[] {
  const groups = new Map<string, SearchTarget>();
  for (const key of ['priorityChecks', 'recurringIssues', 'improvementRequests'] as const) {
    for (const item of result[key]) {
      if (!needsAction(key, item)) continue;
      const k = [...item.feedbackIds].sort((a, b) => a - b).join(',');
      const g = groups.get(k);
      if (g) g.items.push(item);
      else if (groups.size < max) groups.set(k, { query: item.summary, type: item.type, items: [item] });
    }
  }
  return [...groups.values()];
}

/** 검색으로 찾은 자료를 항목에 붙이고 버전 안에서 겹치지 않는 ID(R1, R2, …)를 매긴다. 같은 URL 은 같은 ID. */
export function attachReferences(targets: SearchTarget[], found: Omit<AnalysisReference, 'id'>[][]) {
  const byUrl = new Map<string, AnalysisReference>();
  targets.forEach((t, i) => {
    const refs = (found[i] ?? []).map((r) => {
      let ref = byUrl.get(r.url);
      if (!ref) {
        ref = { ...r, id: `R${byUrl.size + 1}` };
        byUrl.set(r.url, ref);
      }
      return ref;
    });
    for (const item of t.items) item.references = refs;
  });
}

/** 판단 단계에 넘길 항목. key 로 결과를 다시 찾아 붙인다. */
export function judgeTargets(result: AnalysisResult) {
  return ANALYSIS_SECTION_KEYS.flatMap((key) =>
    result[key].flatMap((item, i) => (needsAction(key, item) ? [{ key: `${key}.${i}`, section: key, item }] : [])),
  );
}

export type RawJudgement = AnalysisAction & { key: string };

/** 판단 결과를 항목에 붙인다. 그 항목에 실제로 붙은 참고자료 ID 만 남긴다. */
export function applyJudgements(result: AnalysisResult, judgements: RawJudgement[]) {
  const targets = new Map(judgeTargets(result).map((t) => [t.key, t.item]));
  for (const { key, ...j } of judgements) {
    const item = targets.get(key);
    if (!item || item.action) continue;
    const allowed = new Set(item.references.map((r) => r.id));
    item.action = {
      recommendedAction: squash(j.recommendedAction),
      rationale: squash(j.rationale),
      confidence: j.confidence,
      aiSuitability: j.aiSuitability,
      aiReason: squash(j.aiReason),
      referenceIds: [...new Set(j.referenceIds)].filter((id) => allowed.has(id)),
    };
  }
}

/** DB 에 저장된 결과를 지금 모양으로 맞춘다. 예전 버전은 문자열 목록이었다. */
export function normalizeResult(stored: AnalysisResult | LegacyAnalysisResult): AnalysisResult {
  if ('schemaVersion' in stored && stored.schemaVersion === 2) return stored;
  const legacy = stored as LegacyAnalysisResult;
  const toItems = (list: string[] | undefined): AnalysisItem[] =>
    (list ?? []).map((summary) => ({ summary, type: null, feedbackIds: [], mentionCount: 0, evidence: [], references: [], action: null }));
  return {
    schemaVersion: 1,
    overview: '',
    recurringIssues: toItems(legacy.recurringIssues),
    improvementRequests: toItems(legacy.improvementRequests),
    positiveOpinions: toItems(legacy.positiveOpinions),
    priorityChecks: toItems(legacy.priorityChecks),
  };
}

/** 결과에 나온 피드백 ID 전체 */
export function citedFeedbackIds(result: AnalysisResult): number[] {
  return [...new Set(ANALYSIS_SECTION_KEYS.flatMap((k) => result[k].flatMap((i) => i.feedbackIds)))];
}
