import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { Feedback } from '../feedbacks/entities/feedback.entity';
import { UsersModule } from '../users/users.module';
import { AdminRecruitmentsController } from './admin-recruitments.controller';
import { RecruitmentDevice } from './entities/recruitment-device.entity';
import { Recruitment } from './entities/recruitment.entity';
import { RecruitmentsController } from './recruitments.controller';
import { RecruitmentsService } from './recruitments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Recruitment, RecruitmentDevice, Application, Feedback]), UsersModule],
  controllers: [RecruitmentsController, AdminRecruitmentsController],
  providers: [RecruitmentsService],
  exports: [RecruitmentsService, TypeOrmModule],
})
export class RecruitmentsModule {}
