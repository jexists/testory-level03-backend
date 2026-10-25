import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { IdPipe } from '../../core/pipes/id.pipe';
import { AiAnalysisService } from './ai-analysis.service';

// 분석은 만들기만 가능하고 수정·삭제 API 는 일부러 없다 (R14).
@Controller('admin/recruitments/:id/analyses')
@UseGuards(JwtAuthGuard) @Roles('ADMIN')
export class AiAnalysisController {
  constructor(private svc: AiAnalysisService) {}
  @Post() @HttpCode(201) run(@Param('id', IdPipe) id: number, @CurrentUser() u: AuthUser) { return this.svc.run(id, u.id); }
  @Get() versions(@Param('id', IdPipe) id: number) { return this.svc.versions(id); }
  @Get(':version') one(@Param('id', IdPipe) id: number, @Param('version') v: string) { return this.svc.one(id, v); }
}
