import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from './enums';
import type { User } from '../modules/users/user.entity';

export const IS_PUBLIC = 'isPublic';
/** 로그인 없이 호출할 수 있는 API. 토큰이 있으면 사용자 정보는 채워 준다. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User | undefined => {
  return ctx.switchToHttp().getRequest<Request & { user?: User }>().user;
});

/** 서버가 요청에서 직접 읽는 IP. 사용자가 보낸 값이 아니다. (trust proxy 설정 필요) */
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.ip ?? req.socket.remoteAddress ?? null;
});
