import { ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { MSG } from '../../shared/constants/messages';
import type { Role } from '../../shared/types';

/** 로그인 필수 + 역할 검사(R15). @Roles 가 붙은 곳은 해당 역할만 통과. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  handleRequest(err: any, user: any, _info: any, ctx: ExecutionContext) {
    if (err || !user) throw new HttpException(MSG.NEED_LOGIN, HttpStatus.UNAUTHORIZED);
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException(MSG.ADMIN_ONLY);
    return user;
  }
}
