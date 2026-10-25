import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 로그인 안 해도 통과, 로그인했으면 user 를 채운다. */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(_e: any, user: any) { return user || null; }
}
