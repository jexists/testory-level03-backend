import { Module } from '@nestjs/common';
import { RecruitmentsModule } from '../recruitments/recruitments.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [RecruitmentsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
