import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './common/guards/auth.guard';
import { AppConfigModule } from './config/app-config.module';
import type { Env } from './config/env.schema';
import { buildDataSourceOptions } from './database/data-source';
import { AiAnalysesModule } from './modules/ai-analyses/ai-analyses.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DemoModule } from './modules/demo/demo.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { HealthModule } from './modules/health/health.module';
import { RecruitmentsModule } from './modules/recruitments/recruitments.module';
import { User } from './modules/users/user.entity';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildDataSourceOptions({
          DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
          DATABASE_SCHEMA: config.get('DATABASE_SCHEMA', { infer: true }),
          DATABASE_SSL: config.get('DATABASE_SSL', { infer: true }),
        }),
    }),
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) as never },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      // 자동 테스트는 같은 IP 에서 많은 요청을 보내므로 제한을 끈다. (운영·개발에서는 항상 켜짐)
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    RecruitmentsModule,
    ApplicationsModule,
    FeedbacksModule,
    AiAnalysesModule,
    DashboardModule,
    DemoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
