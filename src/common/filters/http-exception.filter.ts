import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { MSG } from '../messages';

/** 모든 오류를 { statusCode, code, message, details? } 형식으로 통일한다. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: { code: string; message: string; details?: unknown } = {
      code: 'INTERNAL_ERROR',
      message: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'object' && r !== null && 'code' in r && 'message' in r) {
        const o = r as { code: string; message: string; details?: unknown };
        body = { code: o.code, message: o.message, ...(o.details ? { details: o.details } : {}) };
      } else {
        const msg = typeof r === 'string' ? r : ((r as { message?: string | string[] }).message ?? exception.message);
        const text = Array.isArray(msg) ? msg[0] : msg;
        body = {
          code: HTTP_CODE[status] ?? 'ERROR',
          message: status === 429 ? MSG.TOO_MANY_REQUESTS : status === 401 ? MSG.LOGIN_REQUIRED : (text as string),
        };
      }
    } else {
      this.logger.error(exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception));
    }
    res.status(status).json({ statusCode: status, ...body });
  }
}

const HTTP_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};
