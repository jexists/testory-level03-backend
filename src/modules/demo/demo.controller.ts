import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { DemoService } from './demo.service';

@Controller('admin/demo')
@UseGuards(JwtAuthGuard) @Roles('ADMIN')
export class DemoController {
  constructor(private svc: DemoService) {}
  @Post('reset') @HttpCode(200) reset() { return this.svc.reset(); }
}
