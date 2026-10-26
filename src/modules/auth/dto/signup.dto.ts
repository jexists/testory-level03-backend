import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MSG } from '../../../common/messages';
import { DeviceInputDto } from '../../users/dto/device-input.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** 내 기기 항목(deviceType, deviceOsName, deviceModelId, deviceModelName)은 DeviceInputDto 에 있다. */
export class SignupDto extends DeviceInputDto {
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
}
