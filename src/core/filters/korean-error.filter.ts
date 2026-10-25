import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class KoreanErrorFilter implements ExceptionFilter {
  private log = new Logger('Error');
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof HttpException) {
      const body = e.getResponse() as any;
      let message = typeof body === 'string' ? body : body?.message;
      if (Array.isArray(message)) message = message[0];
      if (e.getStatus() === 404 && message === 'Not Found') message = '찾을 수 없는 주소예요.';
      return res.status(e.getStatus()).json({ statusCode: e.getStatus(), message });
    }
    this.log.error((e as Error)?.stack ?? String(e));
    res.status(500).json({ statusCode: 500, message: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' });
  }
}
