const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** 필수 환경변수가 없으면 서버를 띄우기 전에 알려 준다 (값은 출력하지 않는다). */
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`필수 환경변수가 없어요: ${missing.join(', ')} (.env 를 확인해 주세요)`);
  return env;
}
