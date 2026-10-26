import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators';
import { Os } from '../../common/enums';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { User } from './user.entity';
import { toUserView, UsersService } from './users.service';

@ApiTags('내 정보')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiCookieAuth()
  me(@CurrentUser() user: User) {
    return toUserView(user);
  }

  /** 기기 정보를 고칠 수 있는 유일한 API (마이페이지) */
  @Patch('me/device')
  @ApiCookieAuth()
  async updateDevice(@CurrentUser() user: User, @Body() dto: UpdateDeviceDto) {
    const updated = await this.users.updateDevice(user.id, dto);
    return toUserView(updated);
  }

  @Public()
  @Get('device-models')
  @ApiQuery({ name: 'os', enum: Os, required: false })
  deviceModels(@Query('os') os?: Os) {
    const filter = os && (Object.values(Os) as string[]).includes(os) ? os : undefined;
    return this.users.listModels(filter);
  }
}
