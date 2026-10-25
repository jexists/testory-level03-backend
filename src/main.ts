import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { KoreanErrorFilter } from './core/filters/korean-error.filter';
import { validationFactory } from './core/pipes/validation.factory';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const cfg = app.get(ConfigService);
  app.set('trust proxy', true);
  app.enableCors({ origin: cfg.getOrThrow<string[]>('frontendOrigin'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, exceptionFactory: validationFactory }));
  app.useGlobalFilters(new KoreanErrorFilter());
  await app.listen(cfg.getOrThrow<number>('port'));
}
bootstrap();
