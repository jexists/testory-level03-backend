import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Get()
  async health() {
    try { await this.ds.query('select 1'); return { status: 'ok', db: 'connected' }; }
    catch { return { status: 'error', db: 'disconnected' }; }
  }
}
