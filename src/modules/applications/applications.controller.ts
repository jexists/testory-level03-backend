import { Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { User } from '../users/user.entity';
import { ApplicationsService, type ApplicationSort } from './applications.service';

@ApiTags('신청')
@ApiCookieAuth()
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  /** 신청하기 (테스터 전용). 서버가 내 정보의 기기를 읽어 신청 당시 기기로 복사한다. */
  @Roles(Role.USER)
  @Post('recruitments/:id/applications')
  apply(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.applications.apply(id, user);
  }

  /** 취소하기: 본인 신청만, 테스트 시작 전까지만 */
  @Roles(Role.USER)
  @Delete('applications/:id')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.applications.cancel(id, user);
  }

  @Roles(Role.USER)
  @Get('me/applications')
  mine(@CurrentUser() user: User) {
    return this.applications.listMine(user.id);
  }

  /** 관리자: 모집글별 신청자 (sort=feedback_desc 이면 피드백 많은 순) */
  @Roles(Role.ADMIN)
  @Get('admin/recruitments/:id/applications')
  @ApiQuery({ name: 'sort', enum: ['feedback_desc', 'applied_desc'], required: false })
  applicants(@Param('id', ParseIntPipe) id: number, @Query('sort') sort?: string) {
    return this.applications.listApplicants(id, sort === 'feedback_desc' ? 'feedback_desc' : 'applied_desc');
  }
}
