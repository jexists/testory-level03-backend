import { IsEmail, IsNotEmpty } from 'class-validator';
import { MSG } from '../../../shared/constants/messages';

export class LoginDto {
  @IsEmail({}, { message: MSG.INVALID_EMAIL }) email: string;
  @IsNotEmpty({ message: '비밀번호를 입력해 주세요.' }) password: string;
}
