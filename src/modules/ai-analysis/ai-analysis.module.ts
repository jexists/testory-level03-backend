import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbacksModule } from '../feedbacks/feedbacks.module';
import { RecruitmentsModule } from '../recruitments/recruitments.module';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysis } from './entities/ai-analysis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiAnalysis]), RecruitmentsModule, FeedbacksModule],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService],
  exports: [TypeOrmModule],
})
export class AiAnalysisModule {}
