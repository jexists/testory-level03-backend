import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';
import { DemoService } from './demo.service';

@ApiTags('관리자 · 시연 데이터')
@ApiCookieAuth()
@Roles(Role.ADMIN)
@Controller('admin/demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  /** 시연용 가상 데이터를 지우고 다시 만든다. 이미 실행 중이면 409. */
  @Post('reset')
  @HttpCode(200)
  reset() {
    return this.demo.reset();
  }
}
