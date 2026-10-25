import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { OptionalJwtGuard } from '../../core/auth/optional-jwt.guard';
import { IdPipe } from '../../core/pipes/id.pipe';
import { RecruitmentsService } from './recruitments.service';

@Controller('recruitments')
export class RecruitmentsController {
  constructor(private svc: RecruitmentsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') @UseGuards(OptionalJwtGuard)
  detail(@Param('id', IdPipe) id: number, @CurrentUser() u: AuthUser | null) { return this.svc.detail(id, u); }
}
