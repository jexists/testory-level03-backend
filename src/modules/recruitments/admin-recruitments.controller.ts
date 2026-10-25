import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { Ip } from '../../core/decorators/client-ip.decorator';
import { IdPipe } from '../../core/pipes/id.pipe';
import { RecruitmentDto } from './dto/recruitment.dto';
import { RecruitmentsService } from './recruitments.service';

@Controller('admin/recruitments')
@UseGuards(JwtAuthGuard) @Roles('ADMIN')
export class AdminRecruitmentsController {
  constructor(private svc: RecruitmentsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q, true, q.includeDeleted === 'true'); }
  @Get(':id') detail(@Param('id', IdPipe) id: number) { return this.svc.detail(id, null, true); }
  @Post() create(@Body() dto: RecruitmentDto, @CurrentUser() u: AuthUser, @Ip() ip: string) { return this.svc.create(dto, u.id, ip); }
  @Put(':id') update(@Param('id', IdPipe) id: number, @Body() dto: RecruitmentDto, @Ip() ip: string) { return this.svc.update(id, dto, ip); }
  @Delete(':id') @HttpCode(200) remove(@Param('id', IdPipe) id: number, @Ip() ip: string) { return this.svc.remove(id, ip); }
  @Post(':id/close') @HttpCode(200) close(@Param('id', IdPipe) id: number, @Ip() ip: string) { return this.svc.setClosed(id, true, ip); }
  @Post(':id/reopen') @HttpCode(200) reopen(@Param('id', IdPipe) id: number, @Ip() ip: string) { return this.svc.setClosed(id, false, ip); }
}
