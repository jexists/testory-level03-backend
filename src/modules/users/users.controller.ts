import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get() async me(@CurrentUser() u: AuthUser) { return this.svc.view(await this.svc.get(u.id)); }

  @Patch() nickname(@CurrentUser() u: AuthUser, @Body('nickname') n: string) { return this.svc.updateNickname(u.id, n); }

  /** 내 기기 정보를 고칠 수 있는 유일한 API (R7). */
  @Patch('device') device(@CurrentUser() u: AuthUser, @Body() dto: UpdateDeviceDto) { return this.svc.updateDevice(u.id, dto); }
}
