import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard) @Roles('ADMIN')
export class DashboardController {
  constructor(private svc: DashboardService) {}
  @Get() summary() { return this.svc.summary(); }
}
