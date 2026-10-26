import { z } from 'zod';

const bool = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v === 'true'));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 이 필요해요.'),
  DATABASE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, 'DATABASE_SCHEMA 는 소문자, 숫자, _ 만 쓸 수 있어요.')
    .default('testory'),
  DATABASE_SSL: bool,
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 은 16자 이상이어야 해요.'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  GPT_API_KEY: z.string().optional().default(''),
  GPT_MODEL: z.string().default('gpt-4o-mini'),
  // AI 분석의 참고자료 검색(웹 검색 도구)에 쓰는 모델
  GPT_SEARCH_MODEL: z.string().default('gpt-4.1-mini'),
  DEMO_SEED_ENABLED: bool,
  DEMO_PASSWORD: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
    throw new Error(`환경변수 설정이 올바르지 않아요.\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export function allowedOrigins(env: Env): string[] {
  return env.FRONTEND_URL.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
