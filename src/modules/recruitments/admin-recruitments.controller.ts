import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { ClientIp, CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { User } from '../users/user.entity';
import { AdminRecruitmentListQueryDto } from './dto/query.dto';
import { RecruitmentBodyDto } from './dto/recruitment.dto';
import { RecruitmentsService } from './recruitments.service';

@ApiTags('관리자 · 모집글')
@ApiCookieAuth()
@Roles(Role.ADMIN)
@Controller('admin/recruitments')
export class AdminRecruitmentsController {
  constructor(private readonly recruitments: RecruitmentsService) {}

  /** 관리자용 목록 (deleted=include|only 로 삭제된 글 보기, stage 로 진행 단계 거르기) */
  @Get()
  list(@Query() q: AdminRecruitmentListQueryDto) {
    return this.recruitments.list(q, true);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.recruitments.detail(id, true);
  }

  /** 만든 곳 IP 는 서버가 요청에서 읽어 기록한다. */
  @Post()
  create(@Body() dto: RecruitmentBodyDto, @CurrentUser() admin: User, @ClientIp() ip: string | null) {
    return this.recruitments.create(dto, admin.id, ip);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: RecruitmentBodyDto, @ClientIp() ip: string | null) {
    return this.recruitments.update(id, dto, ip);
  }

  /** Soft Delete: 삭제 시각과 삭제한 곳 IP 만 기록한다. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number, @ClientIp() ip: string | null) {
    await this.recruitments.softDelete(id, ip);
  }

  /** 삭제한 글을 되살린다. 삭제 기록(시각·IP)은 지운다. */
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number, @ClientIp() ip: string | null) {
    return this.recruitments.restore(id, ip);
  }

  @Patch(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @ClientIp() ip: string | null) {
    return this.recruitments.setClosed(id, true, ip);
  }

  @Patch(':id/reopen')
  reopen(@Param('id', ParseIntPipe) id: number, @ClientIp() ip: string | null) {
    return this.recruitments.setClosed(id, false, ip);
  }
}
