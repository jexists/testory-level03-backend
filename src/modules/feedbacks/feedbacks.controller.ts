import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { IdPipe } from '../../core/pipes/id.pipe';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbacksService } from './feedbacks.service';

@Controller()
export class FeedbacksController {
  constructor(private svc: FeedbacksService) {}

  @Post('recruitments/:id/feedbacks') @UseGuards(JwtAuthGuard)
  write(@Param('id', IdPipe) id: number, @CurrentUser() u: AuthUser, @Body() dto: CreateFeedbackDto) { return this.svc.write(id, u.id, dto); }

  @Get('me/feedbacks') @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() u: AuthUser) { return this.svc.mine(u.id); }

  @Get('admin/feedbacks') @UseGuards(JwtAuthGuard) @Roles('ADMIN')
  all(@Query() q: any) { return this.svc.listAll(q); }
}
