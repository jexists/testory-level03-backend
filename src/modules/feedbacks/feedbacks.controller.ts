import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { User } from '../users/user.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { AdminFeedbackQueryDto, MyFeedbackQueryDto } from './dto/feedback-query.dto';
import { FeedbacksService } from './feedbacks.service';

@ApiTags('피드백')
@ApiCookieAuth()
@Controller()
export class FeedbacksController {
  constructor(private readonly feedbacks: FeedbacksService) {}

  /** 피드백 작성 (참여 중인 테스터만, 유형 선택 필수) */
  @Roles(Role.USER)
  @Post('recruitments/:id/feedbacks')
  create(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User, @Body() dto: CreateFeedbackDto) {
    return this.feedbacks.create(id, user, dto);
  }

  @Roles(Role.USER)
  @Get('me/feedbacks')
  mine(@CurrentUser() user: User, @Query() q: MyFeedbackQueryDto) {
    return this.feedbacks.listMine(user.id, q);
  }

  /** 관리자: 전체 피드백 (유형별·모집글별 필터, 작성자별 피드백 수 정렬) */
  @Roles(Role.ADMIN)
  @Get('admin/feedbacks')
  admin(@Query() q: AdminFeedbackQueryDto) {
    return this.feedbacks.listAdmin(q);
  }
}
