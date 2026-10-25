import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        url: cfg.getOrThrow<string>('databaseUrl'),
        ssl: { rejectUnauthorized: false }, // Render PostgreSQL 은 SSL 필요
        autoLoadEntities: true, // 각 모듈의 TypeOrmModule.forFeature 에 등록된 엔티티를 자동 등록
        synchronize: true, // 시연용 로컬 구성: 엔티티대로 테이블을 만든다
        extra: { max: 10 },
      }),
    }),
  ],
})
export class DatabaseModule {}
