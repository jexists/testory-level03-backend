import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { forbidden, AppError } from '../app-error';
import { IS_PUBLIC, ROLES } from '../decorators';
import { Role } from '../enums';
import { MSG } from '../messages';
import { User } from '../../modules/users/user.entity';
import { HttpStatus } from '@nestjs/common';

export const AUTH_COOKIE = 'testory_token';

/**
 * 전역 인증·권한 가드.
 * - 토큰이 있으면 매 요청마다 DB 에서 사용자와 role 을 다시 읽는다. (토큰 안의 role 을 믿지 않는다)
 * - @Public() 이 아니면 로그인이 필요하고, @Roles() 가 있으면 role 이 맞아야 한다. (R15)
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: User }>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);

    const token = this.extractToken(req);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
        const user = await this.users.findOne({ where: { id: payload.sub }, relations: { deviceModel: true } });
        if (user) req.user = user;
      } catch {
        // 만료·변조된 토큰은 로그인하지 않은 것으로 본다.
      }
    }

    if (!req.user) {
      if (isPublic) return true;
      throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', MSG.LOGIN_REQUIRED);
    }
    if (roles?.length && !roles.includes(req.user.role)) {
      throw forbidden('FORBIDDEN', roles.includes(Role.ADMIN) ? MSG.FORBIDDEN_ADMIN : MSG.FORBIDDEN_USER_ONLY);
    }
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (cookie) return cookie;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
