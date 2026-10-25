import { Module } from '@nestjs/common';
import { AiAnalysisModule } from '../ai-analysis/ai-analysis.module';
import { ApplicationsModule } from '../applications/applications.module';
import { FeedbacksModule } from '../feedbacks/feedbacks.module';
import { RecruitmentsModule } from '../recruitments/recruitments.module';
import { UsersModule } from '../users/users.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [UsersModule, RecruitmentsModule, ApplicationsModule, FeedbacksModule, AiAnalysisModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
