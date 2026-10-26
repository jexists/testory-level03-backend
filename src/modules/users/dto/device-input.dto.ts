import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Os, OS_OTHER, type OsInput } from '../../../common/enums';
import { MSG } from '../../../common/messages';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * 가입·기기 수정에서 받는 내 기기.
 * - OS 는 목록(ANDROID/IOS)에서 고르거나 OTHER 를 고르고 OS 이름을 직접 입력한다.
 * - 모델은 목록에서 id 로 고르거나 모델명을 직접 입력한다. OS 가 OTHER 면 모델명만 받는다.
 */
export class DeviceInputDto {
  @IsIn([...Object.values(Os), OS_OTHER], { message: MSG.DEVICE_SELECT })
  deviceType: OsInput;

  @ValidateIf((o: DeviceInputDto) => o.deviceType === OS_OTHER)
  @Transform(trim)
  @MaxLength(30, { message: 'OS 이름은 30자 이하로 입력해 주세요.' })
  @IsString({ message: MSG.DEVICE_OS_NAME_REQUIRED })
  // 데코레이터는 아래부터 검사하므로 비어 있을 때의 안내가 먼저 나오게 맨 아래에 둔다.
  @IsNotEmpty({ message: MSG.DEVICE_OS_NAME_REQUIRED })
  deviceOsName?: string;

  /** 모델 목록(device_models)에서 고른 모델의 id */
  @ValidateIf((o: DeviceInputDto) => o.deviceType !== OS_OTHER && o.deviceModelName === undefined)
  @IsInt({ message: MSG.DEVICE_SELECT })
  deviceModelId?: number;

  @ValidateIf((o: DeviceInputDto) => o.deviceType === OS_OTHER || o.deviceModelName !== undefined)
  @Transform(trim)
  @MaxLength(60, { message: '기기 모델명은 60자 이하로 입력해 주세요.' })
  @IsString({ message: MSG.DEVICE_MODEL_NAME_REQUIRED })
  // 데코레이터는 아래부터 검사하므로 비어 있을 때의 안내가 먼저 나오게 맨 아래에 둔다.
  @IsNotEmpty({ message: MSG.DEVICE_MODEL_NAME_REQUIRED })
  deviceModelName?: string;
}
