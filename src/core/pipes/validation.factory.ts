import { BadRequestException, ValidationError } from '@nestjs/common';

/** class-validator 오류 중 첫 번째 쉬운 안내 문구만 돌려준다. */
export function validationFactory(errors: ValidationError[]) {
  const first = errors[0];
  const msg = first && Object.values(first.constraints ?? {})[0];
  return new BadRequestException(msg ?? '입력값을 다시 확인해 주세요.');
}
