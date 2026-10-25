import { Module } from '@nestjs/common';
import { RecruitmentsModule } from '../recruitments/recruitments.module';
import { AiAnalysesController } from './ai-analyses.controller';
import { AiAnalysesService } from './ai-analyses.service';
import { GptClient } from './gpt.client';

@Module({
  imports: [RecruitmentsModule],
  controllers: [AiAnalysesController],
  providers: [AiAnalysesService, GptClient],
})
export class AiAnalysesModule {}
