import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Os } from '../../../common/enums';
import { MSG } from '../../../common/messages';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignupDto {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_FORMAT })
  @MaxLength(255, { message: MSG.EMAIL_FORMAT })
  email: string;

  @IsString({ message: MSG.PASSWORD_SHORT })
  @MinLength(8, { message: MSG.PASSWORD_SHORT })
  @MaxLength(72, { message: '비밀번호는 72자 이하로 만들어 주세요.' })
  password: string;

  @Transform(trim)
  @IsString({ message: MSG.NICKNAME_REQUIRED })
  @IsNotEmpty({ message: MSG.NICKNAME_REQUIRED })
  @MaxLength(30, { message: '닉네임은 30자 이하로 만들어 주세요.' })
  nickname: string;

  /** 내 기기의 OS (브라우저가 알려 주는 값으로 미리 골라 둘 수 있다) */
  @IsEnum(Os, { message: MSG.DEVICE_SELECT })
  deviceType: Os;

  /** 모델 목록에서 고른 모델의 id */
  @IsInt({ message: MSG.DEVICE_SELECT })
  deviceModelId: number;
}
