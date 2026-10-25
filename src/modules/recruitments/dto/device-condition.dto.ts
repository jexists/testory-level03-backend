import { IsIn, IsInt, IsOptional } from 'class-validator';
import { MSG } from '../../../shared/constants/messages';
import type { DeviceScope, Os } from '../../../shared/types';

export class DeviceConditionDto {
  @IsIn(['ANDROID', 'IOS'], { message: MSG.NEED_DEVICE_COND }) os: Os;
  @IsIn(['ALL', 'MODEL'], { message: MSG.NEED_DEVICE_COND }) scope: DeviceScope;
  @IsOptional() @IsInt({ message: MSG.PICK_MODEL }) deviceModelId?: number | null;
}
