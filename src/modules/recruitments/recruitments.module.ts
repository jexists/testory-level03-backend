import { Module } from '@nestjs/common';
import { AdminRecruitmentsController } from './admin-recruitments.controller';
import { RecruitmentsController } from './recruitments.controller';
import { RecruitmentsService } from './recruitments.service';

@Module({
  controllers: [RecruitmentsController, AdminRecruitmentsController],
  providers: [RecruitmentsService],
  exports: [RecruitmentsService],
})
export class RecruitmentsModule {}
