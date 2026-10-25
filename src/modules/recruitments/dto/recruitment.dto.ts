import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
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
import { DeviceScope, Os, RecruitmentKind } from '../../../common/enums';
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

  /** APP_FULL = 앱 전체, FEATURE = 기능별 */
  @IsEnum(RecruitmentKind, { message: '모집 종류를 골라 주세요.' })
  kind: RecruitmentKind;

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

  @IsArray({ message: MSG.DEVICE_CONDITION_MIN })
  @ArrayMinSize(1, { message: MSG.DEVICE_CONDITION_MIN })
  @ValidateNested({ each: true })
  @Type(() => DeviceConditionDto)
  devices: DeviceConditionDto[];
}
