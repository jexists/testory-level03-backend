import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DeviceScope, Os } from '../../../common/enums';
import { MSG } from '../../../common/messages';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class DeviceConditionDto {
  @IsEnum(Os, { message: MSG.DEVICE_CONDITION_MIN })
  os: Os;

  /** ALL = 그 OS 전체, MODEL = 특정 모델 */
  @IsEnum(DeviceScope, { message: MSG.DEVICE_CONDITION_MIN })
  scope: DeviceScope;

  /** scope 가 MODEL 일 때 모델 목록에서 고른 모델 id. ALL 이면 비운다. */
  @IsOptional()
  @IsInt({ message: MSG.DEVICE_PICK_MODEL })
  deviceModelId?: number | null;

  /** 목록에 없는 모델을 "기타"로 직접 입력한 이름. deviceModelId 와 함께 보내지 않는다. */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: MSG.DEVICE_PICK_MODEL })
  @MaxLength(100, { message: '모델명은 100자 이하로 써 주세요.' })
  modelName?: string | null;
}

export class RecruitmentBodyDto {
  @Transform(trim)
  @IsString({ message: MSG.TITLE_REQUIRED })
  @IsNotEmpty({ message: MSG.TITLE_REQUIRED })
  @MaxLength(100, { message: '제목은 100자 이하로 써 주세요.' })
  title: string;

  @Transform(trim)
  @IsString({ message: '설명을 입력해 주세요.' })
  @IsNotEmpty({ message: '설명을 입력해 주세요.' })
  @MaxLength(5000, { message: '설명은 5000자 이하로 써 주세요.' })
  description: string;

  /** 정원 (1~50, 비우면 15) */
  @IsOptional()
  @IsInt({ message: MSG.CAPACITY_RANGE })
  @Min(1, { message: MSG.CAPACITY_RANGE })
  @Max(50, { message: MSG.CAPACITY_RANGE })
  capacity?: number;

  @Type(() => Date)
  @IsDate({ message: '시작일을 입력해 주세요.' })
  startAt: Date;

  @Type(() => Date)
  @IsDate({ message: '종료일을 입력해 주세요.' })
  endAt: Date;

  /** 비우면 종료일 + 3일 */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '피드백 마감일을 다시 확인해 주세요.' })
  feedbackDueAt?: Date;

  /** 빈 배열이면 모든 기기를 받는다. */
  @IsArray({ message: MSG.DEVICE_CONDITION_MIN })
  @ValidateNested({ each: true })
  @Type(() => DeviceConditionDto)
  devices: DeviceConditionDto[];
}
