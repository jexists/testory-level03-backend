import { IsIn, IsNotEmpty } from 'class-validator';
import type { FeedbackType } from '../../../shared/types';

export class CreateFeedbackDto {
  @IsIn(['BUG', 'IMPROVEMENT', 'PRAISE'], { message: '피드백 유형을 골라 주세요.' }) type: FeedbackType;
  @IsNotEmpty({ message: '제목과 내용을 모두 입력해 주세요.' }) title: string;
  @IsNotEmpty({ message: '제목과 내용을 모두 입력해 주세요.' }) content: string;
}
