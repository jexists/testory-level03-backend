import { IsIn, IsInt } from 'class-validator';
import { MSG } from '../../../shared/constants/messages';
import type { Os } from '../../../shared/types';

export class UpdateDeviceDto {
  @IsIn(['ANDROID', 'IOS'], { message: MSG.PICK_DEVICE }) deviceType: Os;
  @IsInt({ message: MSG.PICK_MODEL }) deviceModelId: number;
}
