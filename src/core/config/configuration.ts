export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  frontendOrigin: string[];
  gpt: { apiKey: string; model: string };
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  frontendOrigin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  gpt: { apiKey: process.env.GPT_API_KEY ?? '', model: process.env.GPT_MODEL || 'gpt-4o-mini' },
});
