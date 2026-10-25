import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { MSG } from '../../../shared/constants/messages';
import type { RecruitmentKind } from '../../../shared/types';
import { DeviceConditionDto } from './device-condition.dto';

export class RecruitmentDto {
  @IsNotEmpty({ message: '제목을 입력해 주세요.' }) title: string;
  @IsOptional() description?: string;
  @IsIn(['APP_FULL', 'FEATURE'], { message: '모집 종류를 골라 주세요.' }) kind: RecruitmentKind;
  /** R1: 1~50명, 안 정하면 15명 */
  @IsOptional() @IsInt({ message: MSG.CAPACITY_RANGE }) @Min(1, { message: MSG.CAPACITY_RANGE }) @Max(50, { message: MSG.CAPACITY_RANGE })
  capacity?: number;
  @IsDateString({}, { message: '시작일과 종료일을 입력해 주세요.' }) startAt: string;
  @IsDateString({}, { message: '시작일과 종료일을 입력해 주세요.' }) endAt: string;
  @IsArray({ message: MSG.NEED_DEVICE_COND }) @ArrayMinSize(1, { message: MSG.NEED_DEVICE_COND })
  @ValidateNested({ each: true }) @Type(() => DeviceConditionDto) devices: DeviceConditionDto[];
}
