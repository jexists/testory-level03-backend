import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { FeedbackType } from '../../../common/enums';
import { MSG } from '../../../common/messages';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFeedbackDto {
  /** 작성자가 직접 고른 유형: BUG(버그) / IMPROVEMENT(개선 요청) / PRAISE(칭찬) */
  @IsEnum(FeedbackType, { message: MSG.FEEDBACK_TYPE })
  type: FeedbackType;

  @Transform(trim)
  @IsString({ message: MSG.FEEDBACK_TEXT })
  @IsNotEmpty({ message: MSG.FEEDBACK_TEXT })
  @MaxLength(100, { message: '제목은 100자 이하로 써 주세요.' })
  title: string;

  @Transform(trim)
  @IsString({ message: MSG.FEEDBACK_TEXT })
  @IsNotEmpty({ message: MSG.FEEDBACK_TEXT })
  @MaxLength(2000, { message: '내용은 2000자 이하로 써 주세요.' })
  content: string;
}
