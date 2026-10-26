import { describe, expect, it } from 'vitest';
import { DeviceScope, Os } from '../../common/enums';
import {
  computeStatus,
  describeAllowed,
  deviceMatches,
  validateDeviceConditions,
  type KnownModel,
} from './recruitment-rules';

const models = new Map<number, KnownModel>([
  [1, { id: 1, os: Os.ANDROID, modelName: '갤럭시 S24', isActive: true }],
  [2, { id: 2, os: Os.IOS, modelName: '아이폰 15', isActive: true }],
  [3, { id: 3, os: Os.IOS, modelName: '아이폰 5', isActive: false }],
]);

const msgOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as { getResponse(): { message: string } }).getResponse().message;
  }
  return null;
};

describe('validateDeviceConditions (R8)', () => {
  it('조건이 하나도 없으면 모든 기기를 받는 것으로 허용한다', () => {
    expect(() => validateDeviceConditions([], models)).not.toThrow();
  });

  it('Android 전체 + iOS 특정 모델은 허용한다', () => {
    expect(() =>
      validateDeviceConditions(
        [
          { os: Os.ANDROID, scope: DeviceScope.ALL },
          { os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 2 },
        ],
        models,
      ),
    ).not.toThrow();
  });

  it('Android 전체를 허용했는데 Android 모델을 같이 넣으면 거절한다', () => {
    expect(
      msgOf(() =>
        validateDeviceConditions(
          [
            { os: Os.ANDROID, scope: DeviceScope.ALL },
            { os: Os.ANDROID, scope: DeviceScope.MODEL, deviceModelId: 1 },
          ],
          models,
        ),
      ),
    ).toBe('Android 전체를 허용했으니 Android 모델은 따로 고를 필요가 없어요.');
  });

  it('같은 조건을 두 번 넣을 수 없다', () => {
    expect(
      msgOf(() =>
        validateDeviceConditions(
          [
            { os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 2 },
            { os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 2 },
          ],
          models,
        ),
      ),
    ).toBe('같은 기기 조건을 두 번 넣을 수 없어요.');
  });

  it('목록에 없거나 OS 가 다른 모델은 거절한다', () => {
    expect(msgOf(() => validateDeviceConditions([{ os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 99 }], models))).toBe(
      '모델 목록에서 골라 주세요.',
    );
    expect(msgOf(() => validateDeviceConditions([{ os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 1 }], models))).toBe(
      '선택한 모델이 내 OS와 맞지 않아요.',
    );
  });

  it('비활성 모델은 새로 고를 수 없지만 기존 조건이면 유지할 수 있다', () => {
    const c = [{ os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 3 }];
    expect(msgOf(() => validateDeviceConditions(c, models))).toBe('모델 목록에서 골라 주세요.');
    expect(() => validateDeviceConditions(c, models, new Set([3]))).not.toThrow();
  });
});

describe('deviceMatches / describeAllowed (R5)', () => {
  const conds = [
    { os: Os.ANDROID, scope: DeviceScope.ALL, deviceModelId: null },
    { os: Os.IOS, scope: DeviceScope.MODEL, deviceModelId: 2, modelName: '아이폰 15' },
  ];

  it('OS 전체 조건 또는 모델 조건에 맞아야 한다', () => {
    expect(deviceMatches({ os: Os.ANDROID, modelId: 1 }, conds)).toBe(true);
    expect(deviceMatches({ os: Os.IOS, modelId: 2 }, conds)).toBe(true);
    expect(deviceMatches({ os: Os.IOS, modelId: 7 }, conds)).toBe(false);
  });

  it('조건이 없으면(모든 기기) 직접 입력한 기기도 맞는다', () => {
    expect(deviceMatches({ os: null, modelId: null }, [])).toBe(true);
  });

  it('직접 입력한 모델은 같은 OS 전체 조건에만 맞고, 직접 입력한 OS 는 목록 조건에 맞지 않는다', () => {
    expect(deviceMatches({ os: Os.ANDROID, modelId: null }, conds)).toBe(true);
    expect(deviceMatches({ os: Os.IOS, modelId: null }, conds)).toBe(false);
    expect(deviceMatches({ os: null, modelId: null }, conds)).toBe(false);
  });

  it('거절 문구를 만든다', () => {
    expect(describeAllowed([{ os: Os.ANDROID, scope: DeviceScope.ALL, deviceModelId: null }])).toBe('이 모집은 Android만 받아요.');
    expect(describeAllowed(conds)).toBe('이 모집은 Android, 아이폰 15 기기만 받아요.');
  });
});

describe('computeStatus (R2/R4)', () => {
  const now = new Date('2026-10-25T00:00:00Z');
  const day = 86_400_000;
  const base = { isClosed: false, capacity: 3, participants: 1, startAt: new Date(+now + day), endAt: new Date(+now + 3 * day) };

  it('자리가 있고 시작 전이면 모집 중', () => {
    expect(computeStatus(base, now)).toMatchObject({ status: 'OPEN', closedReason: null, remaining: 2, phase: 'UPCOMING' });
  });

  it('정원이 차면 자동 마감, 취소로 자리가 나면 다시 모집 중', () => {
    expect(computeStatus({ ...base, participants: 3 }, now)).toMatchObject({ status: 'CLOSED', closedReason: 'FULL', remaining: 0 });
    expect(computeStatus({ ...base, participants: 2 }, now).status).toBe('OPEN');
  });

  it('관리자가 직접 마감한 글은 자리가 있어도 마감', () => {
    expect(computeStatus({ ...base, isClosed: true }, now)).toMatchObject({ status: 'CLOSED', closedReason: 'MANUAL' });
  });

  it('시작 후에는 마감이고 진행 중/종료로 구분한다', () => {
    const started = { ...base, startAt: new Date(+now - day) };
    expect(computeStatus(started, now)).toMatchObject({ status: 'CLOSED', closedReason: 'STARTED', phase: 'ONGOING' });
    expect(computeStatus({ ...started, endAt: new Date(+now - 1000) }, now).phase).toBe('ENDED');
  });
});
