export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Os {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

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
