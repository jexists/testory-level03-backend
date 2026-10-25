import { Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { IdPipe } from '../../core/pipes/id.pipe';
import { ApplicationsService } from './applications.service';

@Controller()
export class ApplicationsController {
  constructor(private svc: ApplicationsService) {}

  @Post('recruitments/:id/applications') @UseGuards(JwtAuthGuard)
  apply(@Param('id', IdPipe) id: number, @CurrentUser() u: AuthUser) { return this.svc.apply(id, u.id); }

  @Delete('applications/:id') @UseGuards(JwtAuthGuard) @HttpCode(200)
  cancel(@Param('id', IdPipe) id: number, @CurrentUser() u: AuthUser) { return this.svc.cancel(id, u.id); }

  @Get('me/applications') @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() u: AuthUser) { return this.svc.mine(u.id); }

  @Get('admin/recruitments/:id/applications') @UseGuards(JwtAuthGuard) @Roles('ADMIN')
  applicants(@Param('id', IdPipe) id: number, @Query('sort') sort?: string) { return this.svc.applicants(id, sort); }
}
