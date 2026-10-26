import { Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { badRequest } from '../../common/app-error';
import { User } from '../users/user.entity';
import { AiAnalysesService } from './ai-analyses.service';

@ApiTags('관리자 · AI 분석')
@ApiCookieAuth()
@Roles(Role.ADMIN)
@Controller('admin/recruitments/:id/analyses')
export class AiAnalysesController {
  constructor(private readonly analyses: AiAnalysesService) {}

  /** 모집글의 피드백 전체를 GPT 로 종합 분석하고, 성공하면 새 버전으로 저장한다. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  analyze(@Param('id', ParseIntPipe) id: number, @CurrentUser() admin: User) {
    return this.analyses.analyze(id, admin);
  }

  /** 최신 분석을 "확인 완료"로 표시한다. */
  @Post('review')
  @HttpCode(200)
  review(@Param('id', ParseIntPipe) id: number) {
    return this.analyses.review(id);
  }

  /** 저장된 분석 버전 목록 (버전 번호, 분석 시각, 분석 당시 피드백 수) */
  @Get()
  list(@Param('id', ParseIntPipe) id: number) {
    return this.analyses.listVersions(id);
  }

  /** 저장된 분석 한 버전 불러오기. version 은 latest 또는 버전 번호 */
  @Get(':version')
  get(@Param('id', ParseIntPipe) id: number, @Param('version') version: string) {
    if (version === 'latest') return this.analyses.getVersion(id, 'latest');
    const n = Number(version);
    if (!Number.isInteger(n) || n < 1) throw badRequest('VALIDATION_ERROR', '버전 번호를 다시 확인해 주세요.');
    return this.analyses.getVersion(id, n);
  }
}
