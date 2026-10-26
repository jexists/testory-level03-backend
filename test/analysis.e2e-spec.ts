import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GptClient } from '../src/modules/ai-analyses/gpt.client';
import { createTestApp, endFeedback, insertAdmin, login, recruitmentBody, signup, startTest, type TestCtx } from './helpers';

const CONTENT = '앱을 열자마자 바로 꺼져요. 다시 열어도 같아요.';
const REFERENCE = { url: 'https://docs.example/crash', title: '앱 비정상 종료 확인 방법', citedText: '비정상 종료는 기기 로그로 확인할 수 있어요', query: '앱이 열리자마자 꺼진다는 문제', checkedAt: '2026-10-26T00:00:00.000Z' };

/** 모델의 요약 단계 출력. 입력의 첫 피드백 ID 를 근거로 쓰고, 없는 ID(99999)와 원문에 없는 인용도 섞는다. */
const summaryFor = (feedbackText: string) => {
  const id = Number(/\[F(\d+)\]/.exec(feedbackText)?.[1]);
  return {
    overview: '앱이 바로 꺼진다는 피드백이 있어요.',
    recurringIssues: [{ summary: '한 건뿐인 반복 문제', type: 'bugSuspected', feedbackIds: [id], evidence: [] }],
    improvementRequests: [],
    positiveOpinions: [],
    priorityChecks: [{ summary: '앱이 열리자마자 꺼진다는 문제', type: 'bugSuspected', feedbackIds: [id, 99999], evidence: ['앱을 열자마자 바로 꺼져요.', '지어낸 문장이에요'] }],
  };
};

/** 실제 GPT 를 부르지 않는 가짜 클라이언트 (호출 횟수와 동작을 테스트가 조절한다) */
const fakeGpt = {
  isConfigured: true,
  modelName: 'fake-model',
  calls: 0,
  searches: 0,
  mode: 'ok' as 'ok' | 'fail' | 'slow',
  searchFails: false,
  /** JSON 을 두 조각으로 나눠 흘려보낸다. */
  async *summarizeStream(feedbackText: string) {
    this.calls++;
    if (this.mode === 'fail') throw new Error('boom');
    if (this.mode === 'slow') await new Promise((r) => setTimeout(r, 400));
    const json = JSON.stringify(summaryFor(feedbackText));
    const half = Math.floor(json.length / 2);
    yield json.slice(0, half);
    yield json.slice(half);
    return JSON.parse(json);
  },
  async searchReferences() {
    this.searches++;
    if (this.searchFails) throw new Error('search down');
    return [REFERENCE];
  },
  async judge(itemsText: string) {
    return [...itemsText.matchAll(/^key: (\S+)$/gm)].map(([, key]) => ({
      key,
      recommendedAction: '같은 기기에서 앱을 열어 재현되는지 확인해 보세요.',
      rationale: '피드백 1건에서 나온 문제예요.',
      confidence: 'low',
      aiSuitability: 'unnecessary',
      aiReason: '일반적인 오류 확인이에요.',
      referenceIds: ['R1', 'R7'],
    }));
  },
};

/** 검증을 거쳐 저장되는 결과 (없는 ID, 지어낸 인용, 1건짜리 반복 문제, 없는 참고자료 ID 는 빠진다) */
const expectedResult = (feedbackId: number) => ({
  schemaVersion: 2,
  overview: '앱이 바로 꺼진다는 피드백이 있어요.',
  recurringIssues: [],
  improvementRequests: [],
  positiveOpinions: [],
  priorityChecks: [
    {
      summary: '앱이 열리자마자 꺼진다는 문제',
      type: 'bugSuspected',
      feedbackIds: [feedbackId],
      mentionCount: 1,
      evidence: ['앱을 열자마자 바로 꺼져요.'],
      references: [{ ...REFERENCE, id: 'R1' }],
      action: {
        recommendedAction: '같은 기기에서 앱을 열어 재현되는지 확인해 보세요.',
        rationale: '피드백 1건에서 나온 문제예요.',
        confidence: 'low',
        aiSuitability: 'unnecessary',
        aiReason: '일반적인 오류 확인이에요.',
        referenceIds: ['R1'],
      },
    },
  ],
});

let ctx: TestCtx;
let admin: Awaited<ReturnType<typeof login>>;
let recruitmentId: number;
let emptyId: number;
let feedbackId: number;
let RESULT: ReturnType<typeof expectedResult>;

beforeAll(async () => {
  ctx = await createTestApp((b) => b.overrideProvider(GptClient).useValue(fakeGpt));
  await insertAdmin(ctx);
  admin = await login(ctx, 'admin@test.dev');
  recruitmentId = (await admin.post('/admin/recruitments').send(recruitmentBody())).body.id;
  emptyId = (await admin.post('/admin/recruitments').send(recruitmentBody({ title: '피드백 없음' }))).body.id;
  const u = await signup(ctx, 'writer@test.dev');
  await u.agent.post(`/recruitments/${recruitmentId}/applications`);
  await startTest(ctx, recruitmentId);
  feedbackId = (await u.agent.post(`/recruitments/${recruitmentId}/feedbacks`).send({ type: 'BUG', title: '버그', content: CONTENT })).body.id;
  RESULT = expectedResult(feedbackId);
});
afterAll(async () => {
  await ctx?.close();
});

describe('AI 분석 (R13, R14)', () => {
  it('피드백이 없으면 GPT 를 부르지 않고 안내만 한다 (R13)', async () => {
    const before = fakeGpt.calls;
    const res = await admin.post(`/admin/recruitments/${emptyId}/analyses`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('분석할 피드백이 아직 없어요.');
    expect(fakeGpt.calls).toBe(before);
  });

  it('저장된 분석이 없으면 안내한다', async () => {
    const res = await admin.get(`/admin/recruitments/${recruitmentId}/analyses/latest`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('저장된 분석이 아직 없어요.');
  });

  it('성공하면 새 버전(v1, v2, …)으로 저장된다 (R14)', async () => {
    fakeGpt.mode = 'ok';
    const v1 = await admin.post(`/admin/recruitments/${recruitmentId}/analyses`);
    expect(v1.status).toBe(201);
    expect(v1.body).toMatchObject({ versionNo: 1, feedbackCount: 1, modelName: 'fake-model', result: RESULT });
    const v2 = await admin.post(`/admin/recruitments/${recruitmentId}/analyses`);
    expect(v2.body.versionNo).toBe(2);

    const list = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body;
    expect(list.map((v: { versionNo: number }) => v.versionNo)).toEqual([2, 1]);
    expect((await admin.get(`/admin/recruitments/${recruitmentId}/analyses/latest`)).body.versionNo).toBe(2);
    const old = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses/1`)).body;
    expect(old).toMatchObject({ versionNo: 1, result: RESULT });
  });

  it('근거 피드백의 원문·작성자·신청 기기를 함께 돌려준다', async () => {
    const v = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses/1`)).body;
    expect(Object.keys(v.feedbacks)).toEqual([String(feedbackId)]);
    expect(v.feedbacks[feedbackId]).toMatchObject({ id: feedbackId, type: 'BUG', title: '버그', content: CONTENT, nickname: 'writer', deviceType: 'ANDROID', deviceModel: '갤럭시 S24' });
  });

  it('참고자료 검색이 실패해도 분석은 저장하고 그 항목만 참고자료 없이 둔다', async () => {
    fakeGpt.searchFails = true;
    const res = await admin.post(`/admin/recruitments/${recruitmentId}/analyses`);
    fakeGpt.searchFails = false;
    expect(res.status).toBe(201);
    const item = res.body.result.priorityChecks[0];
    expect(item.references).toEqual([]);
    expect(item.action.referenceIds).toEqual([]);
  });

  it('GPT 호출이 실패하면 새 버전을 만들지 않고 이전 버전은 그대로다 (R14)', async () => {
    fakeGpt.mode = 'fail';
    const res = await admin.post(`/admin/recruitments/${recruitmentId}/analyses`);
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('AI 분석에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
    const list = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body;
    expect(list).toHaveLength(3);
    fakeGpt.mode = 'ok';
  });

  it('분석 중에 다시 눌러도 GPT 를 중복 호출하지 않는다 (R14)', async () => {
    fakeGpt.mode = 'slow';
    const before = fakeGpt.calls;
    const [a, b] = await Promise.all([
      admin.post(`/admin/recruitments/${recruitmentId}/analyses`),
      (async () => {
        await new Promise((r) => setTimeout(r, 100));
        return admin.post(`/admin/recruitments/${recruitmentId}/analyses`);
      })(),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(fakeGpt.calls - before).toBe(1);
    fakeGpt.mode = 'ok';
  });

  it('저장된 버전은 DB 에서도 고치거나 지울 수 없다 (R14)', async () => {
    await expect(ctx.ds.query(`UPDATE "${ctx.schema}"."ai_analyses" SET feedback_count = 99`)).rejects.toThrow();
    await expect(ctx.ds.query(`DELETE FROM "${ctx.schema}"."ai_analyses"`)).rejects.toThrow();
  });

  it('일반 사용자는 분석할 수 없다 (R15)', async () => {
    const { agent } = await signup(ctx, 'nope@test.dev');
    expect((await agent.post(`/admin/recruitments/${recruitmentId}/analyses`)).status).toBe(403);
    expect((await agent.get(`/admin/recruitments/${recruitmentId}/analyses/latest`)).status).toBe(403);
  });

  it('확인 완료를 누르면 종료, 다시 분석하면 분석 완료로 돌아간다', async () => {
    fakeGpt.mode = 'ok';
    const none = await admin.post(`/admin/recruitments/${emptyId}/analyses/review`);
    expect(none.status).toBe(400);
    expect(none.body.message).toBe('확인할 분석이 아직 없어요.');

    const { agent } = await signup(ctx, 'nope2@test.dev');
    expect((await agent.post(`/admin/recruitments/${recruitmentId}/analyses/review`)).status).toBe(403);

    // 피드백 마감 전 분석은 단계를 바꾸지 않는다
    expect((await admin.get(`/admin/recruitments/${recruitmentId}`)).body.stage).toBe('TESTING');
    await endFeedback(ctx, recruitmentId);
    expect((await admin.get(`/admin/recruitments/${recruitmentId}`)).body.stage).toBe('ANALYZED');

    const reviewed = await admin.post(`/admin/recruitments/${recruitmentId}/analyses/review`);
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.analysisReviewedAt).toBeTruthy();
    const after = (await admin.get(`/admin/recruitments/${recruitmentId}`)).body;
    expect(after.stage).toBe('DONE');
    expect(after.analysisReviewedAt).toBeTruthy();
    const dash = (await admin.get('/admin/dashboard')).body;
    expect(dash.recruitments.find((r: { id: number }) => r.id === recruitmentId).stage).toBe('DONE');
    expect(dash.stageCounts.DONE).toBe(1);

    expect((await admin.post(`/admin/recruitments/${recruitmentId}/analyses`)).status).toBe(201);
    expect((await admin.get(`/admin/recruitments/${recruitmentId}`)).body.stage).toBe('ANALYZED');
  });
});

/** SSE 본문을 [이벤트 이름, 데이터] 목록으로 읽는다. */
function readEvents(body: string): [string, unknown][] {
  return body
    .split('\n\n')
    .filter((block) => block.startsWith('event:'))
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return [eventLine.slice('event: '.length), JSON.parse(dataLine.slice('data: '.length))];
    });
}

const postStream = (id: number) =>
  admin
    .post(`/admin/recruitments/${id}/analyses/stream`)
    .buffer(true)
    .parse((res, cb) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (text += chunk));
      res.on('end', () => cb(null, text));
    });

describe('AI 분석 스트리밍', () => {
  it('진행 단계와 모델 출력 조각을 흘려보내고, 끝나면 새 버전을 저장한다', async () => {
    fakeGpt.mode = 'ok';
    const before = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body.length;
    const res = await postStream(recruitmentId);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = readEvents(res.body as string);
    expect(events.map(([e]) => e)).toEqual(['status', 'status', 'delta', 'delta', 'status', 'reference', 'status', 'status', 'done']);
    expect(events.filter(([e]) => e === 'status').map(([, d]) => (d as { step: string }).step)).toEqual(['reading', 'summarizing', 'searching', 'judging', 'saving']);
    expect(events[0][1]).toEqual({ step: 'reading', feedbackCount: 1 });
    expect(events[4][1]).toEqual({ step: 'searching', total: 1 });
    expect(events[5][1]).toEqual({ done: 1, total: 1, found: 1, query: '앱이 열리자마자 꺼진다는 문제', hosts: ['docs.example'] });
    const streamed = events.filter(([e]) => e === 'delta').map(([, d]) => (d as { text: string }).text).join('');
    expect(JSON.parse(streamed).overview).toBe(RESULT.overview);
    expect(events.at(-1)?.[1]).toMatchObject({ versionNo: before + 1, result: RESULT });

    const list = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body;
    expect(list).toHaveLength(before + 1);
  });

  it('GPT 가 실패하면 error 이벤트를 보내고 새 버전을 만들지 않는다', async () => {
    fakeGpt.mode = 'fail';
    const before = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body.length;
    const res = await postStream(recruitmentId);
    const events = readEvents(res.body as string);
    expect(events.at(-1)).toEqual(['error', { code: 'ANALYSIS_FAILED', message: 'AI 분석에 실패했어요. 잠시 뒤 다시 시도해 주세요.' }]);
    expect((await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body).toHaveLength(before);
    fakeGpt.mode = 'ok';

    // 실패한 뒤에도 잠금이 풀려 다시 분석할 수 있다
    expect(readEvents((await postStream(recruitmentId)).body as string).at(-1)?.[0]).toBe('done');
  });

  it('시작 전 검사에 걸리면 스트림을 열지 않고 JSON 오류로 돌려준다', async () => {
    const empty = await admin.post(`/admin/recruitments/${emptyId}/analyses/stream`);
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('분석할 피드백이 아직 없어요.');

    fakeGpt.mode = 'slow';
    const [a, b] = await Promise.all([
      postStream(recruitmentId),
      (async () => {
        await new Promise((r) => setTimeout(r, 100));
        return admin.post(`/admin/recruitments/${recruitmentId}/analyses/stream`);
      })(),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(409);
    fakeGpt.mode = 'ok';
  });

  it('예전 문자열 목록 버전도 지금 모양으로 바꿔 보여 준다', async () => {
    const [{ id: adminId }] = await ctx.ds.query(`SELECT id FROM "${ctx.schema}"."users" WHERE email = 'admin@test.dev'`);
    const legacy = { recurringIssues: ['예전 반복 문제'], improvementRequests: [], positiveOpinions: ['예전 칭찬'], priorityChecks: [] };
    await ctx.ds.query(
      `INSERT INTO "${ctx.schema}"."ai_analyses" (recruitment_id, version_no, result, feedback_count, model_name, created_by) VALUES ($1, 1, $2, 0, 'old-model', $3)`,
      [emptyId, JSON.stringify(legacy), adminId],
    );
    const v = (await admin.get(`/admin/recruitments/${emptyId}/analyses/latest`)).body;
    expect(v.feedbacks).toEqual({});
    expect(v.result).toMatchObject({ schemaVersion: 1, overview: '', improvementRequests: [] });
    expect(v.result.recurringIssues).toEqual([{ summary: '예전 반복 문제', type: null, feedbackIds: [], mentionCount: 0, evidence: [], references: [], action: null }]);
  });
});
