import { OS_LABEL } from '../constants/messages';
import type { Os } from '../types';

/** 기기 조건 한 줄을 화면용 글자로: "Android 전체" / "아이폰 15" */
export const deviceLabel = (d: { os: Os; scope: string; deviceModel?: { modelName: string } | null }) =>
  d.scope === 'ALL' ? `${OS_LABEL[d.os]} 전체` : d.deviceModel?.modelName ?? '';
