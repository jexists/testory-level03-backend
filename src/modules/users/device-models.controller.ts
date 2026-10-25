import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('device-models')
export class DeviceModelsController {
  constructor(private svc: UsersService) {}
  @Get() list(@Query('os') os?: string) { return this.svc.listDeviceModels(os); }
}
