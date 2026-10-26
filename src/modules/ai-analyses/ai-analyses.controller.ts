import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { AppError, badRequest } from '../../common/app-error';
import { MSG } from '../../common/messages';
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

  /**
   * analyze 와 같은 분석을 Server-Sent Events 로 진행 상황과 함께 흘려보낸다.
   * 이벤트: status(reading → analyzing → saving) · delta(모델 출력 JSON 조각) · done(저장한 새 버전) · error
   * 시작 전 검사(피드백 없음, 설정 없음, 이미 분석 중)는 평소처럼 JSON 오류로 돌려준다.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('stream')
  async analyzeStream(@Param('id', ParseIntPipe) id: number, @CurrentUser() admin: User, @Res() res: Response) {
    const job = await this.analyses.startAnalysis(id);

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    // 관리자가 화면을 떠나면 GPT 요청도 끊는다. (요청 본문을 다 읽으면 req 의 close 가 먼저 오므로 res 를 본다)
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const send = (event: string, data: unknown) => {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // 프록시가 조용한 연결을 끊지 않게 주기적으로 빈 주석을 보낸다.
    const ping = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15_000);

    try {
      const detail = await this.analyses.streamAnalysis(job, admin, (e) => send(e.event, e.data), abort.signal);
      send('done', detail);
    } catch (e) {
      // 응답 헤더를 이미 보냈으므로 예외를 던지지 않고 error 이벤트로 알린다.
      const err = e instanceof AppError ? e : new AppError(HttpStatus.BAD_GATEWAY, 'ANALYSIS_FAILED', MSG.ANALYSIS_FAILED);
      send('error', { code: err.code, message: err.message });
    } finally {
      clearInterval(ping);
      res.end();
    }
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
