import { Module } from '@nestjs/common';
import { RecruitmentsModule } from '../recruitments/recruitments.module';
import { FeedbacksController } from './feedbacks.controller';
import { FeedbacksService } from './feedbacks.service';

@Module({
  imports: [RecruitmentsModule],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
})
export class FeedbacksModule {}
