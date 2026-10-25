import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/** npm run openapi — DB 에 접속하지 않고 openapi.json 만 만든다. (프론트엔드 타입 생성용) */
async function main() {
  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Testory API').setVersion('1.0.0').addCookieAuth('testory_token').build(),
  );
  writeFileSync(join(process.cwd(), 'openapi.json'), JSON.stringify(doc, null, 2));
  await app.close();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
