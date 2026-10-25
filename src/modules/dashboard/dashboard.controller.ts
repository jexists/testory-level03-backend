import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { DashboardService } from './dashboard.service';

@ApiTags('관리자 · 현황')
@ApiCookieAuth()
@Roles(Role.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** 첫 화면 숫자 3개(참여자·피드백·버그)와 모집글별 참여자·피드백 수 */
  @Get()
  summary() {
    return this.dashboard.summary();
  }
}
