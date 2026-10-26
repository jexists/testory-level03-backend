import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { buildDataSourceOptions } from '../src/database/data-source';
import { InitSchema1761400000000 } from '../src/database/migrations/1761400000000-InitSchema';
import { DeviceOther1761500000000 } from '../src/database/migrations/1761500000000-DeviceOther';
import { RecruitmentStage1761600000000 } from '../src/database/migrations/1761600000000-RecruitmentStage';

export const PASSWORD = 'test-password-1234';
const DAY = 86_400_000;

export interface TestCtx {
  app: INestApplication;
  ds: DataSource;
  schema: string;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * 실제 PostgreSQL 에 접속하되, 시연·운영 데이터와 섞이지 않도록 테스트 전용 스키마를 만들었다가 지운다.
 * DATABASE_URL 은 .env 에서 읽는다. (GPT 는 호출하지 않는다 — 테스트마다 가짜 클라이언트를 끼운다.)
 */
export async function createTestApp(configure?: (b: ReturnType<typeof Test.createTestingModule>) => void): Promise<TestCtx> {
  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  // 테스트는 가능하면 TEST_DATABASE_URL(로컬 임시 DB)을 쓰고, 없으면 .env 의 DATABASE_URL 에 전용 스키마를 만든다.
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 이 필요해요. (.env)');
  const dbUrl = process.env.DATABASE_URL;

  const schema = `testory_test_${randomBytes(4).toString('hex')}`;
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_SCHEMA = schema;
  process.env.JWT_SECRET = 'test-secret-test-secret';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.GPT_API_KEY = '';
  process.env.DEMO_SEED_ENABLED = 'true';
  process.env.DEMO_PASSWORD = '';

  const migrator = new DataSource({
    ...buildDataSourceOptions({ DATABASE_URL: dbUrl, DATABASE_SCHEMA: schema }),
    migrations: [InitSchema1761400000000, DeviceOther1761500000000, RecruitmentStage1761600000000],
  });
  await migrator.initialize();
  await migrator.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await migrator.runMigrations();
  await migrator.destroy();

  const { AppModule } = await import('../src/app.module');
  const builder = Test.createTestingModule({ imports: [AppModule] });
  configure?.(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const ds = app.get<DataSource>(getDataSourceToken());

  return {
    app,
    ds,
    schema,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
      const cleaner = new DataSource({ type: 'postgres', url: dbUrl, ssl: new URL(dbUrl).hostname === 'localhost' ? false : { rejectUnauthorized: false } });
      await cleaner.initialize();
      await cleaner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await cleaner.destroy();
    },
  };
}

export async function insertAdmin(ctx: TestCtx, email = 'admin@test.dev') {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [row] = await ctx.ds.query(
    `INSERT INTO "${ctx.schema}"."users" (email, password_hash, nickname, role) VALUES ($1,$2,'관리자','ADMIN') RETURNING id`,
    [email, hash],
  );
  return row.id as number;
}

export async function modelId(ctx: TestCtx, name: string): Promise<number> {
  const rows = await ctx.ds.query(`SELECT id FROM "${ctx.schema}"."device_models" WHERE model_name = $1`, [name]);
  return rows[0].id;
}

/** 로그인한 쿠키를 유지하는 요청 도구 */
export async function login(ctx: TestCtx, email: string, password = PASSWORD) {
  const agent = request.agent(ctx.app.getHttpServer());
  const res = await agent.post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function signup(
  ctx: TestCtx,
  email: string,
  device: { deviceType: 'ANDROID' | 'IOS'; model: string } = { deviceType: 'ANDROID', model: '갤럭시 S24' },
) {
  const agent = request.agent(ctx.app.getHttpServer());
  const res = await agent
    .post('/auth/signup')
    .send({ email, password: PASSWORD, nickname: email.split('@')[0], deviceType: device.deviceType, deviceModelId: await modelId(ctx, device.model) });
  if (res.status !== 201) throw new Error(`signup failed ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, id: res.body.user.id as number };
}

export const recruitmentBody = (over: Record<string, unknown> = {}) => ({
  title: '테스트 모집',
  description: '설명',
  kind: 'FEATURE',
  capacity: 15,
  startAt: new Date(Date.now() + 5 * DAY).toISOString(),
  endAt: new Date(Date.now() + 10 * DAY).toISOString(),
  devices: [{ os: 'ANDROID', scope: 'ALL' }],
  ...over,
});

/** 테스트를 시작된 상태로 바꾼다. 피드백은 테스트 중에만 쓸 수 있다. */
export async function startTest(ctx: TestCtx, recruitmentId: number) {
  await ctx.ds.query(
    `UPDATE "${ctx.schema}"."recruitments" SET start_at = now() - interval '1 hour', end_at = now() + interval '5 days', feedback_due_at = now() + interval '8 days' WHERE id = $1`,
    [recruitmentId],
  );
}

/** 피드백 마감일까지 지난 상태로 바꾼다. */
export async function endFeedback(ctx: TestCtx, recruitmentId: number) {
  await ctx.ds.query(
    `UPDATE "${ctx.schema}"."recruitments" SET start_at = now() - interval '10 days', end_at = now() - interval '5 days', feedback_due_at = now() - interval '1 hour' WHERE id = $1`,
    [recruitmentId],
  );
}
