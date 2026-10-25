import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { MSG } from '../../../common/messages';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: MSG.EMAIL_FORMAT })
  email: string;

  @IsString({ message: MSG.PASSWORD_SHORT })
  @MinLength(1, { message: MSG.PASSWORD_SHORT })
  password: string;
}
