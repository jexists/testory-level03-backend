import { DeviceScope, Os, OS_LABEL } from '../../common/enums';
import { badRequest } from '../../common/app-error';
import { MSG } from '../../common/messages';

export interface DeviceConditionInput {
  os: Os;
  scope: DeviceScope;
  deviceModelId?: number | null;
}

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
 * - 특정 모델 조건은 모델 목록에 있는 모델이어야 하고 OS 가 같아야 한다
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
    const key = c.scope === DeviceScope.ALL ? `${c.os}:ALL` : `${c.os}:MODEL:${c.deviceModelId}`;
    if (seen.has(key)) throw badRequest('DEVICE_CONDITION_DUPLICATE', MSG.DEVICE_CONDITION_DUPLICATE);
    seen.add(key);
    if (c.scope === DeviceScope.ALL) {
      if (c.deviceModelId != null) throw badRequest('DEVICE_CONDITION_INVALID', MSG.INVALID_INPUT);
      allOs.add(c.os);
    } else {
      if (c.deviceModelId == null) throw badRequest('DEVICE_PICK_MODEL', MSG.DEVICE_PICK_MODEL);
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
 * 직접 입력한 OS·모델("기타")은 null 이라 목록 기준 조건에는 맞지 않는다.
 */
export function deviceMatches(device: { os: Os | null; modelId: number | null }, conditions: StoredCondition[]): boolean {
  if (conditions.length === 0) return true;
  return conditions.some((c) =>
    c.scope === DeviceScope.ALL ? c.os === device.os : c.deviceModelId === device.modelId,
  );
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
}

/**
 * R2/R4: 모집 상태는 저장하지 않고 계산한다.
 * 관리자가 마감했거나 정원이 찼거나 테스트가 시작되었으면 "마감", 아니면 "모집 중".
 */
export function computeStatus(r: StatusInput, now: Date = new Date()) {
  const started = now.getTime() >= r.startAt.getTime();
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
