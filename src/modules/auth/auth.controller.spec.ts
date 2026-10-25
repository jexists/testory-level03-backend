import { describe, expect, it } from 'vitest';
import { durationToMs } from './auth.controller';

describe('durationToMs', () => {
  it('7d, 12h, 30m, 45s 를 밀리초로 바꾼다', () => {
    expect(durationToMs('7d')).toBe(7 * 86_400_000);
    expect(durationToMs('12h')).toBe(12 * 3_600_000);
    expect(durationToMs('30m')).toBe(30 * 60_000);
    expect(durationToMs('45s')).toBe(45_000);
  });
  it('알 수 없는 형식은 7일로 본다', () => {
    expect(durationToMs('soon')).toBe(7 * 86_400_000);
  });
});
