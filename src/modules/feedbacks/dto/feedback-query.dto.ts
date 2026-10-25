import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FeedbackType } from '../../../common/enums';

const toInt = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));

export enum FeedbackSort {
  LATEST = 'latest',
  AUTHOR_COUNT_DESC = 'author_count_desc',
}

export class MyFeedbackQueryDto {
  /** 특정 모집글에서 쓴 것만 보기 */
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  recruitmentId?: number;
}

export class AdminFeedbackQueryDto {
  @IsOptional()
  @IsEnum(FeedbackType)
  type?: FeedbackType;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  recruitmentId?: number;

  /** latest(기본) / author_count_desc(작성자별 피드백 많은 순) */
  @IsOptional()
  @IsEnum(FeedbackSort)
  sort?: FeedbackSort;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
