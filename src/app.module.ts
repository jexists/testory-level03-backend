import { Module } from '@nestjs/common';
import { CoreAuthModule } from './core/auth/core-auth.module';
import { AppConfigModule } from './core/config/app-config.module';
import { DatabaseModule } from './core/database/database.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DemoModule } from './modules/demo/demo.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { HealthModule } from './modules/health/health.module';
import { RecruitmentsModule } from './modules/recruitments/recruitments.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // core
    AppConfigModule, DatabaseModule, CoreAuthModule,
    // features
    HealthModule, AuthModule, UsersModule, RecruitmentsModule, ApplicationsModule, FeedbacksModule,
    AiAnalysisModule, DashboardModule, DemoModule,
  ],
})
export class AppModule {}
