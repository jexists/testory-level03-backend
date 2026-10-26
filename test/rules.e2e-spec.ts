import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, endFeedback, insertAdmin, login, modelId, PASSWORD, recruitmentBody, signup, startTest, type TestCtx } from './helpers';

const DAY = 86_400_000;
let ctx: TestCtx;
let admin: Awaited<ReturnType<typeof login>>;

const createRecruitment = async (over: Record<string, unknown> = {}) => {
  const res = await admin.post('/admin/recruitments').send(recruitmentBody(over));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: number };
};

beforeAll(async () => {
  ctx = await createTestApp();
  await insertAdmin(ctx);
  admin = await login(ctx, 'admin@test.dev');
});
afterAll(async () => {
  await ctx?.close();
});

describe('health', () => {
  it('DB 연결 상태를 알려 준다', async () => {
    const res = await ctx.http().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });
});

describe('회원가입·로그인·권한 (R7, R15)', () => {
  it('잘못된 입력은 쉬운 안내로 거절한다', async () => {
    const res = await ctx.http().post('/auth/signup').send({ email: 'abc', password: '123', nickname: '', deviceType: 'IOS' });
    expect(res.status).toBe(400);
    expect(res.body.details).toMatchObject({
      email: '이메일 주소를 다시 확인해 주세요. 예: name@example.com',
      password: '비밀번호는 8자 이상으로 만들어 주세요.',
      deviceModelId: '내 기기를 선택해 주세요.',
    });
  });

  it('가입은 항상 일반 사용자이고, 요청에 role 을 실어도 무시한다', async () => {
    const res = await ctx
      .http()
      .post('/auth/signup')
      .send({ email: 'sneaky@test.dev', password: PASSWORD, nickname: 'sneaky', role: 'ADMIN', deviceType: 'ANDROID', deviceModelId: await modelId(ctx, '픽셀 8') });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
  });

  it('이미 가입한 이메일은 거절한다', async () => {
    await signup(ctx, 'dup@test.dev');
    const res = await ctx
      .http()
      .post('/auth/signup')
      .send({ email: 'DUP@test.dev', password: PASSWORD, nickname: 'x', deviceType: 'ANDROID', deviceModelId: await modelId(ctx, '픽셀 8') });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('이미 가입된 이메일이에요. 로그인해 주세요.');
  });

  it('틀린 비밀번호는 로그인할 수 없다', async () => {
    const res = await ctx.http().post('/auth/login').send({ email: 'dup@test.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('일반 사용자와 로그인 안 한 사람은 관리자 API 를 쓸 수 없다', async () => {
    const { agent } = await signup(ctx, 'plain@test.dev');
    for (const [method, path] of [
      ['get', '/admin/dashboard'],
      ['get', '/admin/recruitments'],
      ['post', '/admin/recruitments'],
      ['get', '/admin/feedbacks'],
      ['post', '/admin/demo/reset'],
      ['post', '/admin/recruitments/1/analyses'],
      ['get', '/admin/recruitments/1/analyses'],
    ] as const) {
      expect((await agent[method](path).send({})).status, `${method} ${path}`).toBe(403);
      expect((await ctx.http()[method](path).send({})).status, `anon ${method} ${path}`).toBe(401);
    }
  });

  it('기기 정보 수정: 목록의 모델만, 내 OS 와 맞아야 한다 (R7)', async () => {
    const { agent } = await signup(ctx, 'dev@test.dev');
    const iphone = await modelId(ctx, '아이폰 15');
    const bad = await agent.patch('/me/device').send({ deviceType: 'ANDROID', deviceModelId: iphone });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('선택한 모델이 내 OS와 맞지 않아요.');
    const missing = await agent.patch('/me/device').send({ deviceType: 'IOS', deviceModelId: 99999 });
    expect(missing.body.message).toBe('모델 목록에서 골라 주세요.');
    const ok = await agent.patch('/me/device').send({ deviceType: 'IOS', deviceModelId: iphone });
    expect(ok.status).toBe(200);
    expect(ok.body.deviceModel.modelName).toBe('아이폰 15');
  });

  it('목록에 없는 기기는 OS·모델 이름을 직접 입력하고, 입력한 이름만 저장한다', async () => {
    const base = { password: PASSWORD, nickname: 'other' };
    const noName = await ctx.http().post('/auth/signup').send({ ...base, email: 'other0@test.dev', deviceType: 'OTHER', deviceModelName: '폰' });
    expect(noName.status).toBe(400);
    expect(noName.body.details).toMatchObject({ deviceOsName: 'OS 이름을 입력해 주세요.' });

    const os = await ctx
      .http()
      .post('/auth/signup')
      .send({ ...base, email: 'other1@test.dev', deviceType: 'OTHER', deviceOsName: ' HarmonyOS ', deviceModelName: 'Mate 60' });
    expect(os.status).toBe(201);
    expect(os.body.user).toMatchObject({ deviceType: null, deviceOsName: 'HarmonyOS', deviceModel: { id: null, modelName: 'Mate 60' } });

    const model = await ctx.http().post('/auth/signup').send({ ...base, email: 'other2@test.dev', deviceType: 'ANDROID', deviceModelName: '갤럭시 Z 폴드 6' });
    expect(model.status).toBe(201);
    expect(model.body.user).toMatchObject({ deviceType: 'ANDROID', deviceOsName: null, deviceModel: { id: null, modelName: '갤럭시 Z 폴드 6' } });

    const both = await ctx
      .http()
      .post('/auth/signup')
      .send({ ...base, email: 'other3@test.dev', deviceType: 'OTHER', deviceOsName: 'X', deviceModelId: await modelId(ctx, '픽셀 8') });
    expect(both.status).toBe(400);
  });
});

describe('모집글 등록·수정·삭제 (R1, R8, R10, R11, R12)', () => {
  it('정원 0명·51명은 거절하고, 비우면 15명이 된다', async () => {
    for (const capacity of [0, 51]) {
      const res = await admin.post('/admin/recruitments').send(recruitmentBody({ capacity }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('정원은 1명 이상 50명 이하로 정해 주세요.');
    }
    const { capacity, ...noCapacity } = recruitmentBody();
    void capacity;
    const res = await admin.post('/admin/recruitments').send(noCapacity);
    expect(res.status).toBe(201);
    expect(res.body.capacity).toBe(15);
  });

  it('DB 에도 1~50 제한이 있어 서버를 우회해도 저장되지 않는다', async () => {
    await expect(
      ctx.ds.query(
        `INSERT INTO "${ctx.schema}"."recruitments" (title, description, kind, capacity, start_at, end_at, created_by) VALUES ('x','x','FEATURE',51, now(), now() + interval '1 day', 1)`,
      ),
    ).rejects.toThrow();
  });

  it('제목·기간·기기 조건 검사', async () => {
    expect((await admin.post('/admin/recruitments').send(recruitmentBody({ title: '  ' }))).body.message).toBe('제목을 입력해 주세요.');
    const early = await admin
      .post('/admin/recruitments')
      .send(recruitmentBody({ startAt: new Date(Date.now() + 5 * DAY).toISOString(), endAt: new Date(Date.now() + 2 * DAY).toISOString() }));
    expect(early.body.message).toBe('종료일은 시작일보다 늦어야 해요.');
  });

  it('기기 조건이 없으면 모든 기기를 받는다', async () => {
    const any = await admin.post('/admin/recruitments').send(recruitmentBody({ title: '아무 기기 모집', devices: [] }));
    expect(any.status).toBe(201);
    expect(any.body.devices).toEqual([]);
    const androidList = (await ctx.http().get(`/recruitments?os=ANDROID&q=${encodeURIComponent('아무 기기 모집')}`)).body.items;
    expect(androidList.map((i: { id: number }) => i.id)).toContain(any.body.id);
  });

  it('Android 전체 + Android 모델은 거절, Android 전체 + iOS 모델은 허용 (R8)', async () => {
    const overlap = await admin.post('/admin/recruitments').send(
      recruitmentBody({
        devices: [
          { os: 'ANDROID', scope: 'ALL' },
          { os: 'ANDROID', scope: 'MODEL', deviceModelId: await modelId(ctx, '갤럭시 S24') },
        ],
      }),
    );
    expect(overlap.status).toBe(400);
    expect(overlap.body.message).toBe('Android 전체를 허용했으니 Android 모델은 따로 고를 필요가 없어요.');
    const ok = await admin.post('/admin/recruitments').send(
      recruitmentBody({
        devices: [
          { os: 'ANDROID', scope: 'ALL' },
          { os: 'IOS', scope: 'MODEL', deviceModelId: await modelId(ctx, '아이폰 15') },
        ],
      }),
    );
    expect(ok.status).toBe(201);
    expect(ok.body.devices.map((d: { label: string }) => d.label)).toEqual(['Android 전체', '아이폰 15']);
  });

  it('만든 곳·고친 곳·삭제한 곳 IP 를 서버가 기록한다 (R12)', async () => {
    const r = await createRecruitment();
    const row = async () => (await ctx.ds.query(`SELECT * FROM "${ctx.schema}"."recruitments" WHERE id = $1`, [r.id]))[0];
    expect((await row()).created_ip).toBeTruthy();
    await ctx.ds.query(`UPDATE "${ctx.schema}"."recruitments" SET updated_ip = NULL WHERE id = $1`, [r.id]);
    const upd = await admin.patch(`/admin/recruitments/${r.id}`).set('X-Forwarded-For', '203.0.113.77').send(recruitmentBody({ title: '고침' }));
    expect(upd.status).toBe(200);
    expect(upd.body.title).toBe('고침');
    expect((await row()).updated_ip).toBeTruthy();
  });

  it('정원을 현재 참여자 수보다 줄일 수 없다 (R10)', async () => {
    const r = await createRecruitment({ capacity: 5 });
    for (const n of [1, 2, 3]) {
      const { agent } = await signup(ctx, `cap${n}@test.dev`);
      expect((await agent.post(`/recruitments/${r.id}/applications`)).status).toBe(201);
    }
    const res = await admin.patch(`/admin/recruitments/${r.id}`).send(recruitmentBody({ capacity: 2 }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 3명이 참여 중이라 3명보다 줄일 수 없어요.');
    expect((await admin.patch(`/admin/recruitments/${r.id}`).send(recruitmentBody({ capacity: 3 }))).status).toBe(200);
  });

  it('삭제는 Soft Delete 이고 일반 사용자에게는 어디에도 보이지 않는다 (R11)', async () => {
    const r = await createRecruitment({ title: '삭제될 글' });
    const { agent, id: userId } = await signup(ctx, 'softdel@test.dev');
    const applied = await agent.post(`/recruitments/${r.id}/applications`);
    expect(applied.status).toBe(201);
    await ctx.ds.query(`INSERT INTO "${ctx.schema}"."feedbacks" (recruitment_id, user_id, type, title, content) VALUES ($1,$2,'BUG','t','c')`, [r.id, userId]);

    const before = (await admin.get('/admin/dashboard')).body;
    expect((await admin.delete(`/admin/recruitments/${r.id}`).set('X-Forwarded-For', '203.0.113.9')).status).toBe(204);

    expect((await ctx.http().get(`/recruitments/${r.id}`)).status).toBe(404);
    expect((await ctx.http().get(`/recruitments/${r.id}`)).body.message).toBe('찾을 수 없는 모집글이에요.');
    const list = (await ctx.http().get('/recruitments?limit=50')).body.items;
    expect(list.find((i: { id: number }) => i.id === r.id)).toBeUndefined();
    expect((await agent.get('/me/applications')).body.find((a: { recruitment: { id: number } }) => a.recruitment.id === r.id)).toBeUndefined();
    expect((await agent.get('/me/feedbacks')).body.find((f: { recruitmentId: number }) => f.recruitmentId === r.id)).toBeUndefined();

    const { agent: other } = await signup(ctx, 'softdel2@test.dev');
    expect((await other.post(`/recruitments/${r.id}/applications`)).status).toBe(404);
    expect((await agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'BUG', title: 'a', content: 'b' })).status).toBe(404);

    const after = (await admin.get('/admin/dashboard')).body;
    const ids = (d: { recruitments: { id: number }[] }) => d.recruitments.map((x) => x.id);
    expect(ids(before)).toContain(r.id);
    expect(ids(after)).not.toContain(r.id);
    expect(after.counts.recruiting).toBe(before.counts.recruiting - 1);
    expect(after.stageCounts.RECRUITING).toBe(before.stageCounts.RECRUITING - 1);

    const row = (await ctx.ds.query(`SELECT deleted_at, deleted_ip FROM "${ctx.schema}"."recruitments" WHERE id = $1`, [r.id]))[0];
    expect(row.deleted_at).toBeTruthy();
    expect(row.deleted_ip).toBeTruthy();
    const adminList = (await admin.get('/admin/recruitments?deleted=only')).body.items;
    expect(adminList.map((i: { id: number }) => i.id)).toContain(r.id);
  });
});

describe('신청·취소 (R1~R6, R15)', () => {
  it('내 기기가 조건에 맞아야 신청할 수 있다 (R5)', async () => {
    const r = await createRecruitment({ devices: [{ os: 'ANDROID', scope: 'ALL' }] });
    const { agent } = await signup(ctx, 'ios1@test.dev', { deviceType: 'IOS', model: '아이폰 14' });
    const res = await agent.post(`/recruitments/${r.id}/applications`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이 모집은 Android만 받아요.');

    const only15 = await createRecruitment({ devices: [{ os: 'IOS', scope: 'MODEL', deviceModelId: await modelId(ctx, '아이폰 15') }] });
    expect((await agent.post(`/recruitments/${only15.id}/applications`)).body.message).toBe('이 모집은 아이폰 15 기기만 받아요.');
  });

  it('직접 입력한 기기: 모델만 입력했으면 같은 OS 전체 조건, OS 를 입력했으면 모든 기기 모집에만 신청된다 (R5)', async () => {
    const androidAll = await createRecruitment({ devices: [{ os: 'ANDROID', scope: 'ALL' }] });
    const pixelOnly = await createRecruitment({ devices: [{ os: 'ANDROID', scope: 'MODEL', deviceModelId: await modelId(ctx, '픽셀 8') }] });
    const anyDevice = await createRecruitment({ devices: [] });

    const fold = request.agent(ctx.app.getHttpServer());
    await fold.post('/auth/signup').send({ email: 'fold@test.dev', password: PASSWORD, nickname: 'fold', deviceType: 'ANDROID', deviceModelName: '폴드 6' });
    expect((await fold.post(`/recruitments/${androidAll.id}/applications`)).status).toBe(201);
    expect((await fold.post(`/recruitments/${pixelOnly.id}/applications`)).status).toBe(400);

    const harmony = request.agent(ctx.app.getHttpServer());
    await harmony
      .post('/auth/signup')
      .send({ email: 'harmony@test.dev', password: PASSWORD, nickname: 'harmony', deviceType: 'OTHER', deviceOsName: 'HarmonyOS', deviceModelName: 'Mate 60' });
    expect((await harmony.post(`/recruitments/${androidAll.id}/applications`)).body.message).toBe('이 모집은 Android만 받아요.');
    const applied = await harmony.post(`/recruitments/${anyDevice.id}/applications`);
    expect(applied.status).toBe(201);
    expect(applied.body).toMatchObject({ deviceType: 'HarmonyOS', deviceModel: 'Mate 60' });
  });

  it('관리자는 신청할 수 없다', async () => {
    const r = await createRecruitment();
    expect((await admin.post(`/recruitments/${r.id}/applications`)).status).toBe(403);
  });

  it('신청 당시 기기가 복사되고, 이후 마이페이지에서 바꿔도 그대로다 (R6)', async () => {
    const r = await createRecruitment({ devices: [{ os: 'ANDROID', scope: 'ALL' }, { os: 'IOS', scope: 'ALL' }] });
    const { agent } = await signup(ctx, 'snap@test.dev', { deviceType: 'ANDROID', model: '갤럭시 S24' });
    // 요청에 기기 값을 실어도 쓰지 않는다
    const applied = await agent.post(`/recruitments/${r.id}/applications`).send({ deviceType: 'IOS', deviceModel: '해킹폰' });
    expect(applied.status).toBe(201);
    expect(applied.body).toMatchObject({ deviceType: 'ANDROID', deviceModel: '갤럭시 S24' });

    await agent.patch('/me/device').send({ deviceType: 'IOS', deviceModelId: await modelId(ctx, '아이폰 15') });
    const mine = (await agent.get('/me/applications')).body.find((a: { recruitment: { id: number } }) => a.recruitment.id === r.id);
    expect(mine).toMatchObject({ deviceType: 'ANDROID', deviceModel: '갤럭시 S24' });
    const applicants = (await admin.get(`/admin/recruitments/${r.id}/applications`)).body;
    expect(applicants[0]).toMatchObject({ deviceType: 'ANDROID', deviceModel: '갤럭시 S24' });
  });

  it('같은 모집글에 중복 신청은 거절하고, 취소 후에는 다시 신청된다 (R3)', async () => {
    const r = await createRecruitment();
    const { agent } = await signup(ctx, 'again@test.dev');
    const first = await agent.post(`/recruitments/${r.id}/applications`);
    expect(first.status).toBe(201);
    const dup = await agent.post(`/recruitments/${r.id}/applications`);
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe('이미 신청한 모집글이에요.');
    expect((await agent.delete(`/applications/${first.body.id}`)).status).toBe(200);
    const re = await agent.post(`/recruitments/${r.id}/applications`);
    expect(re.status).toBe(201);
    expect(re.body.id).not.toBe(first.body.id);
    const rows = await ctx.ds.query(`SELECT status FROM "${ctx.schema}"."applications" WHERE recruitment_id = $1 ORDER BY id`, [r.id]);
    expect(rows.map((x: { status: string }) => x.status)).toEqual(['CANCELLED', 'APPLIED']);
  });

  it('정원이 차면 자동 마감되고 테스트가 바로 시작되어, 더 신청하거나 취소할 수 없다 (R1, R2)', async () => {
    const r = await createRecruitment({ capacity: 2 });
    const a = await signup(ctx, 'full1@test.dev');
    const b = await signup(ctx, 'full2@test.dev');
    const c = await signup(ctx, 'full3@test.dev');
    const first = await a.agent.post(`/recruitments/${r.id}/applications`);
    expect(first.body.canCancel).toBe(true);
    expect((await b.agent.post(`/recruitments/${r.id}/applications`)).status).toBe(201);
    const over = await c.agent.post(`/recruitments/${r.id}/applications`);
    expect(over.status).toBe(400);
    expect(over.body.message).toBe('테스트가 이미 시작되어 신청할 수 없어요.');
    const detail = (await ctx.http().get(`/recruitments/${r.id}`)).body;
    expect(detail).toMatchObject({ status: 'CLOSED', closedReason: 'FULL', remaining: 0, phase: 'ONGOING', stage: 'TESTING' });
    expect(detail.testStartedAt).toBeTruthy();
    const cancel = await a.agent.delete(`/applications/${first.body.id}`);
    expect(cancel.status).toBe(400);
    expect(cancel.body.message).toBe('테스트가 이미 시작되어 취소할 수 없어요.');
    // 시작일 전이라도 테스트 중이므로 피드백을 쓸 수 있다
    expect((await a.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'BUG', title: 't', content: 'c' })).status).toBe(201);
    expect((await admin.get(`/admin/recruitments/${r.id}`)).body.stage).toBe('TESTING');
  });

  it('정원이 차기 전에는 취소하면 자리가 다시 난다', async () => {
    const r = await createRecruitment({ capacity: 3 });
    const a = await signup(ctx, 'seat1@test.dev');
    const app = await a.agent.post(`/recruitments/${r.id}/applications`);
    expect((await a.agent.delete(`/applications/${app.body.id}`)).status).toBe(200);
    expect((await ctx.http().get(`/recruitments/${r.id}`)).body).toMatchObject({ status: 'OPEN', remaining: 3, stage: 'RECRUITING' });
  });

  it('동시에 몰려도 정원을 넘지 않는다 (R1)', async () => {
    const r = await createRecruitment({ capacity: 3 });
    // 가입은 차례로 한다(supertest 가 같은 서버를 동시에 여러 번 listen 하면 가끔 실패한다). 몰리는 건 신청뿐이다.
    const users = [];
    for (let i = 0; i < 8; i++) users.push(await signup(ctx, `race${i}@test.dev`));
    const results = await Promise.all(users.map((u) => u.agent.post(`/recruitments/${r.id}/applications`)));
    const ok = results.filter((x) => x.status === 201).length;
    expect(ok).toBe(3);
    // 정원이 차면 테스트가 바로 시작되므로 늦은 신청은 "자리 없음" 또는 "이미 시작"으로 거절된다
    expect(results.filter((x) => x.status !== 201).every((x) => x.status === 409 || x.status === 400)).toBe(true);
    const [{ n }] = await ctx.ds.query(`SELECT COUNT(*)::int AS n FROM "${ctx.schema}"."applications" WHERE recruitment_id = $1 AND status = 'APPLIED'`, [r.id]);
    expect(n).toBe(3);
  });

  it('같은 사람이 동시에 두 번 눌러도 한 번만 신청된다 (R3)', async () => {
    const r = await createRecruitment();
    const { agent } = await signup(ctx, 'double@test.dev');
    const results = await Promise.all([1, 2, 3].map(() => agent.post(`/recruitments/${r.id}/applications`)));
    expect(results.filter((x) => x.status === 201)).toHaveLength(1);
  });

  it('다른 사람의 신청은 취소할 수 없다 (R15)', async () => {
    const r = await createRecruitment();
    const owner = await signup(ctx, 'owner@test.dev');
    const other = await signup(ctx, 'other@test.dev');
    const app = await owner.agent.post(`/recruitments/${r.id}/applications`);
    const res = await other.agent.delete(`/applications/${app.body.id}`);
    expect(res.status).toBe(403);
    expect((await ctx.ds.query(`SELECT status FROM "${ctx.schema}"."applications" WHERE id = $1`, [app.body.id]))[0].status).toBe('APPLIED');
  });

  it('테스트가 시작된 뒤에는 신청도 취소도 거절한다 (R4)', async () => {
    const r = await createRecruitment();
    const joined = await signup(ctx, 'late1@test.dev');
    const late = await signup(ctx, 'late2@test.dev');
    const app = await joined.agent.post(`/recruitments/${r.id}/applications`);
    await ctx.ds.query(
      `UPDATE "${ctx.schema}"."recruitments" SET start_at = now() - interval '1 hour', end_at = now() + interval '5 days' WHERE id = $1`,
      [r.id],
    );
    const cancel = await joined.agent.delete(`/applications/${app.body.id}`);
    expect(cancel.status).toBe(400);
    expect(cancel.body.message).toBe('테스트가 이미 시작되어 취소할 수 없어요.');
    expect((await late.agent.post(`/recruitments/${r.id}/applications`)).status).toBe(400);
  });

  it('관리자가 직접 마감한 글은 신청할 수 없고, 마감 해제하면 다시 받는다', async () => {
    const r = await createRecruitment();
    const { agent } = await signup(ctx, 'manual@test.dev');
    await admin.patch(`/admin/recruitments/${r.id}/close`);
    expect((await agent.post(`/recruitments/${r.id}/applications`)).status).toBe(409);
    await admin.patch(`/admin/recruitments/${r.id}/reopen`);
    expect((await agent.post(`/recruitments/${r.id}/applications`)).status).toBe(201);
  });
});

describe('피드백 (R9)', () => {
  it('참여 중인 사람만, 유형을 골라야 쓸 수 있다', async () => {
    const r = await createRecruitment();
    const member = await signup(ctx, 'fb1@test.dev');
    const outsider = await signup(ctx, 'fb2@test.dev');
    await member.agent.post(`/recruitments/${r.id}/applications`);
    await startTest(ctx, r.id);

    const denied = await outsider.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'BUG', title: 't', content: 'c' });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toBe('참여 중인 모집글에만 쓸 수 있어요.');

    const noType = await member.agent.post(`/recruitments/${r.id}/feedbacks`).send({ title: 't', content: 'c' });
    expect(noType.status).toBe(400);
    expect(noType.body.message).toBe('피드백 유형을 골라 주세요.');
    const noText = await member.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'BUG', title: ' ', content: '' });
    expect(noText.body.message).toBe('제목과 내용을 모두 입력해 주세요.');

    const ok = await member.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'IMPROVEMENT', title: '제목', content: '내용' });
    expect(ok.status).toBe(201);
    expect(ok.body.type).toBe('IMPROVEMENT');
  });

  it('취소한 사람은 더 이상 피드백을 쓸 수 없다', async () => {
    const r = await createRecruitment();
    const u = await signup(ctx, 'fb3@test.dev');
    const app = await u.agent.post(`/recruitments/${r.id}/applications`);
    await u.agent.delete(`/applications/${app.body.id}`);
    expect((await u.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'BUG', title: 't', content: 'c' })).status).toBe(403);
  });

  it('피드백은 테스트 중에만 쓸 수 있다 (시작 전·마감 후 거절)', async () => {
    const r = await createRecruitment();
    const u = await signup(ctx, 'fbwin@test.dev');
    await u.agent.post(`/recruitments/${r.id}/applications`);
    const body = { type: 'BUG', title: 't', content: 'c' };
    const early = await u.agent.post(`/recruitments/${r.id}/feedbacks`).send(body);
    expect(early.status).toBe(400);
    expect(early.body.message).toBe('테스트가 시작되면 피드백을 쓸 수 있어요.');
    await startTest(ctx, r.id);
    expect((await u.agent.post(`/recruitments/${r.id}/feedbacks`).send(body)).status).toBe(201);
    await endFeedback(ctx, r.id);
    const late = await u.agent.post(`/recruitments/${r.id}/feedbacks`).send(body);
    expect(late.status).toBe(400);
    expect(late.body.message).toBe('피드백 마감일이 지나 더 쓸 수 없어요.');
    // 테스터에게는 "피드백 마감", 관리자에게는 "피드백 완료"로 보인다
    expect((await ctx.http().get(`/recruitments/${r.id}`)).body.stage).toBe('FEEDBACK_CLOSED');
    expect((await admin.get(`/admin/recruitments/${r.id}`)).body.stage).toBe('FEEDBACK_DONE');
    expect((await u.agent.get('/me/applications')).body[0].recruitment.stage).toBe('FEEDBACK_CLOSED');
  });

  it('신청자 조회는 피드백 수를 그때그때 세어 많은 순으로 정렬한다', async () => {
    const r = await createRecruitment();
    const quiet = await signup(ctx, 'quiet@test.dev');
    const loud = await signup(ctx, 'loud@test.dev');
    await quiet.agent.post(`/recruitments/${r.id}/applications`);
    await loud.agent.post(`/recruitments/${r.id}/applications`);
    await startTest(ctx, r.id);
    for (const t of ['BUG', 'PRAISE', 'IMPROVEMENT']) {
      await loud.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: t, title: t, content: 'c' });
    }
    await quiet.agent.post(`/recruitments/${r.id}/feedbacks`).send({ type: 'BUG', title: 'b', content: 'c' });

    const sorted = (await admin.get(`/admin/recruitments/${r.id}/applications?sort=feedback_desc`)).body;
    expect(sorted.map((a: { nickname: string; feedbackCount: number }) => [a.nickname, a.feedbackCount])).toEqual([
      ['loud', 3],
      ['quiet', 1],
    ]);
    const all = (await admin.get(`/admin/feedbacks?recruitmentId=${r.id}&type=BUG`)).body;
    expect(all.total).toBe(2);
    const bySize = (await admin.get(`/admin/feedbacks?recruitmentId=${r.id}&sort=author_count_desc`)).body.items;
    expect(bySize[0].nickname).toBe('loud');
    expect(bySize[0].authorFeedbackCount).toBeGreaterThanOrEqual(3);
  });
});

describe('시연 데이터 초기화 (R16)', () => {
  it('일반 사용자는 못 하고, 관리자가 동시에 두 번 누르면 한 번만 실행된다', async () => {
    const results = await Promise.all([admin.post('/admin/demo/reset'), admin.post('/admin/demo/reset')]);
    const codes = results.map((r) => r.status).sort();
    expect(codes).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.message).toBe('이미 초기화 중이에요.');
    const ok = results.find((r) => r.status === 200)!.body;
    expect(ok).toMatchObject({ testers: 20, recruitments: 5, feedbacks: 30, analyses: 2 });

    // 관리자 계정은 남고, 시연 데이터가 채워졌다
    const dash = (await admin.get('/admin/dashboard')).body;
    expect(dash.recruitments).toHaveLength(5);
    expect(dash.recruitments.reduce((n: number, r: { feedbackCount: number }) => n + r.feedbackCount, 0)).toBe(30);
    expect(dash.counts).toEqual({ recruiting: 2, closingSoon: 1, filledEarly: 1 });
    expect(dash.stageCounts).toEqual({ RECRUITING: 2, RECRUIT_CLOSED: 0, TESTING: 1, FEEDBACK_DONE: 1, ANALYZED: 1, DONE: 0 });
    const states = (await ctx.http().get('/recruitments?limit=50')).body.items.map((i: { title: string; stage: string }) => [i.title, i.stage]);
    expect(states).toEqual(
      expect.arrayContaining([
        ['하루칸 앱 전체 베타 테스트', 'TESTING'],
        ['알림 기능 테스트', 'FEEDBACK_CLOSED'],
        ['캘린더 화면 개선 테스트', 'FEEDBACK_CLOSED'],
        ['일정 공유 기능 테스트', 'RECRUITING'],
      ]),
    );
    expect((await login(ctx, 'tester01@testory.demo', 'testory-demo-1234')).get).toBeDefined();
  });
});
