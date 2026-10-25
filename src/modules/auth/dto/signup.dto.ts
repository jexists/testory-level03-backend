import { IsEmail, IsIn, IsInt, IsNotEmpty, MinLength } from 'class-validator';
import { MSG } from '../../../shared/constants/messages';
import type { Os } from '../../../shared/types';

export class SignupDto {
  @IsEmail({}, { message: MSG.INVALID_EMAIL }) email: string;
  @MinLength(8, { message: '비밀번호는 8자 이상으로 만들어 주세요.' }) password: string;
  @IsNotEmpty({ message: '닉네임을 입력해 주세요.' }) nickname: string;
  @IsIn(['ANDROID', 'IOS'], { message: MSG.PICK_DEVICE }) deviceType: Os;
  @IsInt({ message: MSG.PICK_DEVICE }) deviceModelId: number;
}
