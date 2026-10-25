import type { Os } from '../types';

export const OS_LABEL: Record<Os, string> = { ANDROID: 'Android', IOS: 'iOS' };

export const MSG = {
  RECRUITMENT_NOT_FOUND: '찾을 수 없는 모집글이에요.',
  ITEM_NOT_FOUND: '찾을 수 없는 항목이에요.',
  NEED_LOGIN: '로그인이 필요해요.',
  ADMIN_ONLY: '관리자만 쓸 수 있는 기능이에요.',
  PICK_DEVICE: '내 기기를 선택해 주세요.',
  PICK_MODEL: '모델 목록에서 골라 주세요.',
  CAPACITY_RANGE: '정원은 1명 이상 50명 이하로 정해 주세요.',
  NEED_DEVICE_COND: '기기 조건을 하나 이상 선택해 주세요.',
  INVALID_EMAIL: '이메일 주소를 다시 확인해 주세요. 예: name@example.com',
} as const;
