import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators';
import { User } from '../users/user.entity';
import { RecruitmentListQueryDto } from './dto/query.dto';
import { RecruitmentsService } from './recruitments.service';

@ApiTags('모집글')
@Controller('recruitments')
export class RecruitmentsController {
  constructor(private readonly recruitments: RecruitmentsService) {}

  /** 목록: 기기 종류·모집 상태 필터, 제목 검색. 삭제된 글은 보이지 않는다. */
  @Public()
  @Get()
  list(@Query() q: RecruitmentListQueryDto) {
    return this.recruitments.list(q);
  }

  /** 상세: 남은 자리와 허용 기기 조건 포함. 로그인했다면 내 신청 상태(myApplication)도 함께 내려준다. */
  @Public()
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user?: User) {
    return this.recruitments.detail(id, false, user?.id);
  }
}
