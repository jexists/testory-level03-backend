import { DeviceScope, Os, OS_LABEL } from '../../common/enums';
import { badRequest } from '../../common/app-error';
import { MSG } from '../../common/messages';

export interface DeviceConditionInput {
  os: Os;
  scope: DeviceScope;
  deviceModelId?: number | null;
  /** "기타"로 직접 입력한 모델명 */
  modelName?: string | null;
}

/** 직접 입력한 모델명은 대소문자·공백 차이를 무시하고 비교한다. */
export const normalizeModelName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export interface KnownModel {
  id: number;
  os: Os;
  modelName: string;
  isActive: boolean;
}

/**
 * R8: 모집글의 기기 조건 검사.
 * - 조건이 없으면 "모든 기기"를 받는다. 같은 조건 중복 금지
 * - 한 OS 를 "전체"로 허용했다면 그 OS 의 특정 모델 조건은 함께 둘 수 없다
 * - 특정 모델 조건은 모델 목록에서 고르거나("기타") 모델명을 직접 입력한다. 목록 모델은 OS 가 같아야 한다
 * keepModelIds 에 있는 비활성 모델은 (기존 조건 유지용으로) 허용한다.
 */
export function validateDeviceConditions(
  conditions: DeviceConditionInput[],
  models: Map<number, KnownModel>,
  keepModelIds: Set<number> = new Set(),
): void {
  const seen = new Set<string>();
  const allOs = new Set<Os>();
  for (const c of conditions) {
    const typed = c.modelName ? normalizeModelName(c.modelName) : '';
    const key =
      c.scope === DeviceScope.ALL ? `${c.os}:ALL` : c.deviceModelId != null ? `${c.os}:MODEL:${c.deviceModelId}` : `${c.os}:NAME:${typed}`;
    if (seen.has(key)) throw badRequest('DEVICE_CONDITION_DUPLICATE', MSG.DEVICE_CONDITION_DUPLICATE);
    seen.add(key);
    if (c.scope === DeviceScope.ALL) {
      if (c.deviceModelId != null || c.modelName) throw badRequest('DEVICE_CONDITION_INVALID', MSG.INVALID_INPUT);
      allOs.add(c.os);
    } else if (c.deviceModelId == null) {
      if (!typed) throw badRequest('DEVICE_PICK_MODEL', MSG.DEVICE_PICK_MODEL);
    } else {
      if (c.modelName) throw badRequest('DEVICE_CONDITION_INVALID', MSG.INVALID_INPUT);
      const m = models.get(c.deviceModelId);
      if (!m || (!m.isActive && !keepModelIds.has(m.id))) throw badRequest('DEVICE_PICK_MODEL', MSG.DEVICE_PICK_MODEL);
      if (m.os !== c.os) throw badRequest('DEVICE_OS_MISMATCH', MSG.DEVICE_OS_MISMATCH);
    }
  }
  for (const c of conditions) {
    if (c.scope === DeviceScope.MODEL && allOs.has(c.os)) {
      throw badRequest('DEVICE_CONDITION_OVERLAP', MSG.DEVICE_CONDITION_ALL_OVERLAP(OS_LABEL[c.os]));
    }
  }
}

export interface StoredCondition {
  os: Os;
  scope: DeviceScope;
  deviceModelId: number | null;
  modelName?: string | null;
}

/**
 * R5: 조건이 없으면(모든 기기) 누구나, 아니면 내 OS 가 ALL 조건에 있거나 내 모델이 MODEL 조건에 있어야 한다.
 * 직접 입력한 모델 조건("기타")은 OS 가 같고 내 모델명이 같으면(대소문자·공백 무시) 맞는다.
 * 직접 입력한 OS 는 null 이라 어떤 조건에도 맞지 않는다.
 */
export function deviceMatches(
  device: { os: Os | null; modelId: number | null; modelName?: string | null },
  conditions: StoredCondition[],
): boolean {
  if (conditions.length === 0) return true;
  return conditions.some((c) => {
    if (c.scope === DeviceScope.ALL) return c.os === device.os;
    if (c.deviceModelId != null) return c.deviceModelId === device.modelId;
    return c.os === device.os && !!c.modelName && !!device.modelName && normalizeModelName(c.modelName) === normalizeModelName(device.modelName);
  });
}

/** "이 모집은 Android만 받아요." 같은 거절 문구 */
export function describeAllowed(conditions: StoredCondition[]): string {
  const onlyAll = conditions.every((c) => c.scope === DeviceScope.ALL);
  const names = conditions.map((c) => (c.scope === DeviceScope.ALL ? OS_LABEL[c.os] : (c.modelName ?? '선택한 모델')));
  return onlyAll ? `이 모집은 ${names.join(', ')}만 받아요.` : `이 모집은 ${names.join(', ')} 기기만 받아요.`;
}

export type RecruitmentStatus = 'OPEN' | 'CLOSED';
export type ClosedReason = 'MANUAL' | 'FULL' | 'STARTED' | null;
export type RecruitmentPhase = 'UPCOMING' | 'ONGOING' | 'ENDED';

export interface StatusInput {
  isClosed: boolean;
  capacity: number;
  participants: number;
  startAt: Date;
  endAt: Date;
  /** 정원이 차서 시작일보다 일찍 테스트가 시작된 시각 */
  testStartedAt?: Date | null;
}

/** 테스트가 실제로 시작되는 시각: 시작일(모집 마감일)과 정원이 찬 시각 중 빠른 쪽 */
export function effectiveStartAt(r: { startAt: Date; testStartedAt?: Date | null }): Date {
  return r.testStartedAt && r.testStartedAt.getTime() < r.startAt.getTime() ? r.testStartedAt : r.startAt;
}

/**
 * R2/R4: 모집 상태는 저장하지 않고 계산한다.
 * 관리자가 마감했거나 정원이 찼거나 테스트가 시작되었으면 "마감", 아니면 "모집 중".
 */
export function computeStatus(r: StatusInput, now: Date = new Date()) {
  const started = now.getTime() >= effectiveStartAt(r).getTime();
  const full = r.participants >= r.capacity;
  const closedReason: ClosedReason = r.isClosed ? 'MANUAL' : full ? 'FULL' : started ? 'STARTED' : null;
  const phase: RecruitmentPhase = now.getTime() >= r.endAt.getTime() ? 'ENDED' : started ? 'ONGOING' : 'UPCOMING';
  return {
    status: (closedReason ? 'CLOSED' : 'OPEN') as RecruitmentStatus,
    closedReason,
    phase,
    remaining: Math.max(r.capacity - r.participants, 0),
  };
}

/** 관리자가 보는 진행 단계 */
export type Stage = 'RECRUITING' | 'RECRUIT_CLOSED' | 'TESTING' | 'FEEDBACK_DONE' | 'ANALYZED' | 'DONE';
/** 테스터가 보는 진행 단계. 피드백 마감 뒤의 단계는 하나로 묶는다. */
export type PublicStage = 'RECRUITING' | 'RECRUIT_CLOSED' | 'TESTING' | 'FEEDBACK_CLOSED';
export const STAGES: Stage[] = ['RECRUITING', 'RECRUIT_CLOSED', 'TESTING', 'FEEDBACK_DONE', 'ANALYZED', 'DONE'];

/** "곧 모집 마감"으로 볼 기간 (대시보드 카드·마감 임박 필터가 함께 쓴다) */
export const CLOSING_SOON_DAYS = 7;

/**
 * 관리자 목록 필터. 진행 단계를 그대로 쓰지 않고 관리자가 할 일 기준으로 묶는다.
 * 삭제된 글은 DELETED 에만 들어가고, 모집 마감(RECRUIT_CLOSED)은 "전체"에서만 보인다.
 */
export type AdminListFilter = 'RECRUITING' | 'CLOSING_SOON' | 'TESTING' | 'NEEDS_ANALYSIS' | 'ANALYZED' | 'DONE' | 'DELETED';
export const ADMIN_LIST_FILTERS: AdminListFilter[] = ['RECRUITING', 'CLOSING_SOON', 'TESTING', 'NEEDS_ANALYSIS', 'ANALYZED', 'DONE', 'DELETED'];

export interface StageInput extends StatusInput {
  feedbackDueAt: Date;
  /** 가장 최근 AI 분석 시각. 분석이 없으면 null */
  latestAnalysisAt: Date | null;
  analysisReviewedAt: Date | null;
}

/**
 * 모집 중 → 모집 마감 → 테스트 중 → 피드백 완료 → 분석 완료 → 종료.
 * 피드백 마감 전에 돌린 분석은 단계를 바꾸지 않는다.
 * 확인 완료 뒤 분석을 다시 돌리면 "분석 완료"로 돌아간다.
 */
export function computeStage(r: StageInput, now: Date = new Date()): Stage {
  if (now.getTime() >= r.feedbackDueAt.getTime()) {
    if (!r.latestAnalysisAt) return 'FEEDBACK_DONE';
    const reviewed = r.analysisReviewedAt && r.analysisReviewedAt.getTime() >= r.latestAnalysisAt.getTime();
    return reviewed ? 'DONE' : 'ANALYZED';
  }
  if (now.getTime() >= effectiveStartAt(r).getTime()) return 'TESTING';
  return computeStatus(r, now).status === 'CLOSED' ? 'RECRUIT_CLOSED' : 'RECRUITING';
}

export function toPublicStage(stage: Stage): PublicStage {
  return stage === 'FEEDBACK_DONE' || stage === 'ANALYZED' || stage === 'DONE' ? 'FEEDBACK_CLOSED' : stage;
}

/** 피드백은 테스트가 시작된 뒤부터 피드백 마감일 전까지만 쓸 수 있다. */
export function feedbackWindow(r: { startAt: Date; testStartedAt?: Date | null; feedbackDueAt: Date }, now: Date = new Date()) {
  if (now.getTime() < effectiveStartAt(r).getTime()) return 'NOT_STARTED' as const;
  if (now.getTime() >= r.feedbackDueAt.getTime()) return 'CLOSED' as const;
  return 'OPEN' as const;
}

/** 피드백 마감일 기본값: 종료일 + 3일 */
export const FEEDBACK_GRACE_DAYS = 3;
export const defaultFeedbackDueAt = (endAt: Date) => new Date(endAt.getTime() + FEEDBACK_GRACE_DAYS * 86_400_000);
