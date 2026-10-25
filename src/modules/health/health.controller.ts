import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators';

@ApiTags('확인')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** 서버가 떠 있는지와 DB 연결 여부를 알려 준다. 연결 정보는 내보내지 않는다. */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    try {
      await this.ds.query('SELECT 1');
      return { status: 'ok', database: 'connected', time: new Date().toISOString() };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', database: 'disconnected', time: new Date().toISOString() };
    }
  }
}
