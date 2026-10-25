import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DemoService } from '../modules/demo/demo.service';

/** npm run seed — 시연 데이터를 지우고 다시 만든다. 운영에서는 DEMO_SEED_ENABLED 와 DEMO_PASSWORD 가 필요하다. */
async function main() {
  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const counts = await app.get(DemoService).reset();
    console.log('시연 데이터를 만들었어요:', counts);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
