export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Os {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

/** 사용자 기기 입력에서만 쓰는 "기타" 신호. 저장하지 않고, 직접 입력한 이름만 저장한다. */
export const OS_OTHER = 'OTHER';
export type OsInput = Os | typeof OS_OTHER;

export enum RecruitmentKind {
  APP_FULL = 'APP_FULL',
  FEATURE = 'FEATURE',
}

export enum DeviceScope {
  ALL = 'ALL',
  MODEL = 'MODEL',
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  CANCELLED = 'CANCELLED',
}

export enum FeedbackType {
  BUG = 'BUG',
  IMPROVEMENT = 'IMPROVEMENT',
  PRAISE = 'PRAISE',
}

export const OS_LABEL: Record<Os, string> = {
  [Os.ANDROID]: 'Android',
  [Os.IOS]: 'iOS',
};
