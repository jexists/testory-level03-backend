import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { forbidden } from './common/app-error';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { createValidationPipe } from './common/validation';
import { allowedOrigins, type Env } from './config/env.schema';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 서버 실행과 테스트가 같은 설정을 쓰도록 한곳에 모았다. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const origins = allowedOrigins({ FRONTEND_URL: config.get('FRONTEND_URL', { infer: true }) } as Env);

  // Render 같은 프록시 뒤에서 실제 클라이언트 IP 를 읽기 위해 필요하다. (IP 기록, R12)
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: origins, credentials: true });

  // CSRF 보완: 브라우저가 Origin 을 보낸 변경 요청은 허용한 프론트엔드 주소에서 온 것만 받는다.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!SAFE_METHODS.has(req.method) && origin && !origins.includes(origin.replace(/\/$/, ''))) {
      return next(forbidden('FORBIDDEN_ORIGIN', '허용되지 않은 출처의 요청이에요.'));
    }
    next();
  });

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
}

export function setupSwagger(app: INestApplication) {
  const doc = new DocumentBuilder()
    .setTitle('Testory API')
    .setDescription('베타테스터 모집·피드백 관리 (테스토리) 백엔드 API')
    .setVersion('1.0.0')
    .addCookieAuth('testory_token')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs-json' });
}
