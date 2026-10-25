import { IsEnum, IsInt } from 'class-validator';
import { Os } from '../../../common/enums';
import { MSG } from '../../../common/messages';

export class UpdateDeviceDto {
  /** 내 기기의 OS */
  @IsEnum(Os, { message: MSG.DEVICE_SELECT })
  deviceType: Os;

  /** 모델 목록(device_models)에서 고른 모델의 id */
  @IsInt({ message: MSG.DEVICE_PICK_MODEL })
  deviceModelId: number;
}
