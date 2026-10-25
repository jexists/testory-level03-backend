import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { AiAnalysis } from '../modules/ai-analyses/ai-analysis.entity';
import { Application } from '../modules/applications/application.entity';
import { Feedback } from '../modules/feedbacks/feedback.entity';
import { RecruitmentDevice } from '../modules/recruitments/recruitment-device.entity';
import { Recruitment } from '../modules/recruitments/recruitment.entity';
import { DeviceModel } from '../modules/users/device-model.entity';
import { User } from '../modules/users/user.entity';

export const ENTITIES = [User, DeviceModel, Recruitment, RecruitmentDevice, Application, Feedback, AiAnalysis];

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export interface DbEnv {
  DATABASE_URL: string;
  DATABASE_SCHEMA: string;
  DATABASE_SSL?: boolean;
}

/** Nest 앱과 마이그레이션 CLI 가 같은 연결 설정을 쓴다. 스키마 변경은 마이그레이션으로만 한다. */
export function buildDataSourceOptions(env: DbEnv): DataSourceOptions {
  // 비어 있으면(자동) localhost 가 아닐 때 SSL 을 켠다.
  const ssl = typeof env.DATABASE_SSL === 'boolean' ? env.DATABASE_SSL : !isLocalHost(env.DATABASE_URL);
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    schema: env.DATABASE_SCHEMA,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
    migrationsTableName: 'migrations',
    synchronize: false,
    // 무료 DB 는 오래 놀던 연결을 끊을 수 있어 keepAlive 를 켜고 연결 수를 작게 유지한다.
    extra: { max: 8, keepAlive: true, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 15_000 },
    logging: ['error'],
  };
}

function loadDotEnv() {
  const file = join(process.cwd(), '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

/** TypeORM CLI (migration:show / revert) 용 기본 export */
loadDotEnv();
const url = process.env.DATABASE_URL;
export default new DataSource(
  buildDataSourceOptions({
    DATABASE_URL: url ?? 'postgresql://localhost/unset',
    DATABASE_SCHEMA: process.env.DATABASE_SCHEMA ?? 'testory',
    DATABASE_SSL: process.env.DATABASE_SSL ? process.env.DATABASE_SSL === 'true' : undefined,
  }),
);
