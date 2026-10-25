import type { Request } from 'express';

/** 요청에서 클라이언트 IP를 서버가 직접 읽는다 (사용자 입력 아님, R12). */
export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.socket.remoteAddress || '';
  const ip = raw.replace(/^::ffff:/, '');
  return ip === '::1' ? '127.0.0.1' : ip.slice(0, 64);
}
