import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Os } from '../../../common/enums';
import { ADMIN_LIST_FILTERS, STAGES, type AdminListFilter, type Stage } from '../recruitment-rules';

export enum StatusFilter {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum DeletedFilter {
  EXCLUDE = 'exclude',
  INCLUDE = 'include',
  ONLY = 'only',
}

const toInt = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));

export class RecruitmentListQueryDto {
  /** 기기 종류 필터 (비우면 전체) */
  @IsOptional()
  @IsEnum(Os)
  os?: Os;

  /** 모집 상태 필터 (비우면 전체) */
  @IsOptional()
  @IsEnum(StatusFilter)
  status?: StatusFilter;

  /** 제목 검색어 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AdminRecruitmentListQueryDto extends RecruitmentListQueryDto {
  /** 삭제된 글 포함 여부: exclude(기본) / include / only */
  @IsOptional()
  @IsEnum(DeletedFilter)
  deleted?: DeletedFilter;

  /** 진행 단계 필터 (비우면 전체) */
  @IsOptional()
  @IsIn(STAGES)
  stage?: Stage;

  /** 관리자 목록 필터 (비우면 전체). deleted 와 함께 쓰면 deleted 로 먼저 거른다. */
  @IsOptional()
  @IsIn(ADMIN_LIST_FILTERS)
  filter?: AdminListFilter;
}
