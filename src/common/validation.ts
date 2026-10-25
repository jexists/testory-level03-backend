import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { AppError } from './app-error';
import { MSG } from './messages';

/** class-validator 오류를 첫 번째 쉬운 문구 + 항목별 details 로 바꾼다. */
export function createValidationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
    exceptionFactory: (errors: ValidationError[]) => {
      const details: Record<string, string> = {};
      const walk = (errs: ValidationError[], prefix = '') => {
        for (const e of errs) {
          const path = prefix ? `${prefix}.${e.property}` : e.property;
          if (e.constraints) details[path] = Object.values(e.constraints)[0];
          if (e.children?.length) walk(e.children, path);
        }
      };
      walk(errors);
      const first = Object.values(details)[0] ?? MSG.INVALID_INPUT;
      const err = new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', first);
      (err.getResponse() as Record<string, unknown>).details = details;
      return err;
    },
  });
}
