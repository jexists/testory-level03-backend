import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { Public } from '../../common/decorators';
import { AUTH_COOKIE } from '../../common/guards/auth.guard';
import type { Env } from '../../config/env.schema';
import { toUserView } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

/** "7d", "12h", "30m", "45s" → 밀리초 (쿠키 수명용) */
export function durationToMs(value: string): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!m) return 7 * 24 * 3600 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[(m[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 로그인 토큰은 JS 가 읽을 수 없는 httpOnly 쿠키로만 전달한다. */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
    };
  }

  private setCookie(res: Response, token: string) {
    const maxAge = durationToMs(this.config.get('JWT_EXPIRES_IN', { infer: true }));
    res.cookie(AUTH_COOKIE, token, { ...this.cookieOptions(), maxAge });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.signup(dto);
    this.setCookie(res, token);
    return { user: toUserView(user) };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    this.setCookie(res, token);
    return { user: toUserView(user) };
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, this.cookieOptions());
  }
}
