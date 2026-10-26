import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GptClient } from '../src/modules/ai-analyses/gpt.client';
import { createTestApp, endFeedback, insertAdmin, login, recruitmentBody, signup, startTest, type TestCtx } from './helpers';

const RESULT = {
  recurringIssues: ['반복 문제'],
  improvementRequests: ['개선 요청'],
  positiveOpinions: ['긍정 의견'],
  priorityChecks: ['먼저 확인'],
};

/** 실제 GPT 를 부르지 않는 가짜 클라이언트 (호출 횟수와 동작을 테스트가 조절한다) */
const fakeGpt = {
  isConfigured: true,
  modelName: 'fake-model',
  calls: 0,
  mode: 'ok' as 'ok' | 'fail' | 'slow',
  async analyze() {
    this.calls++;
    if (this.mode === 'fail') throw new Error('boom');
    if (this.mode === 'slow') await new Promise((r) => setTimeout(r, 400));
    return RESULT;
  },
};

let ctx: TestCtx;
let admin: Awaited<ReturnType<typeof login>>;
let recruitmentId: number;
let emptyId: number;

beforeAll(async () => {
  ctx = await createTestApp((b) => b.overrideProvider(GptClient).useValue(fakeGpt));
  await insertAdmin(ctx);
  admin = await login(ctx, 'admin@test.dev');
  recruitmentId = (await admin.post('/admin/recruitments').send(recruitmentBody())).body.id;
  emptyId = (await admin.post('/admin/recruitments').send(recruitmentBody({ title: '피드백 없음' }))).body.id;
  const u = await signup(ctx, 'writer@test.dev');
  await u.agent.post(`/recruitments/${recruitmentId}/applications`);
  await startTest(ctx, recruitmentId);
  await u.agent.post(`/recruitments/${recruitmentId}/feedbacks`).send({ type: 'BUG', title: '버그', content: '내용' });
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

  it('GPT 호출이 실패하면 새 버전을 만들지 않고 이전 버전은 그대로다 (R14)', async () => {
    fakeGpt.mode = 'fail';
    const res = await admin.post(`/admin/recruitments/${recruitmentId}/analyses`);
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('AI 분석에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
    const list = (await admin.get(`/admin/recruitments/${recruitmentId}/analyses`)).body;
    expect(list).toHaveLength(2);
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
