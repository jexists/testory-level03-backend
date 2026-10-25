import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { clientIp } from '../../shared/utils/client-ip.util';

export const Ip = createParamDecorator((_d: unknown, ctx: ExecutionContext) => clientIp(ctx.switchToHttp().getRequest()));
