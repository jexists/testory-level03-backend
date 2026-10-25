import { HttpException, HttpStatus } from '@nestjs/common';

/** 사람이 읽을 수 있는 한국어 메시지와 기계가 읽는 code 를 함께 내려주는 오류 */
export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
  ) {
    super({ code, message }, status);
  }
}

export const badRequest = (code: string, message: string) => new AppError(HttpStatus.BAD_REQUEST, code, message);
export const forbidden = (code: string, message: string) => new AppError(HttpStatus.FORBIDDEN, code, message);
export const notFound = (code: string, message: string) => new AppError(HttpStatus.NOT_FOUND, code, message);
export const conflict = (code: string, message: string) => new AppError(HttpStatus.CONFLICT, code, message);
