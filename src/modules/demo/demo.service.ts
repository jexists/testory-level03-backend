import { ConflictException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import type { Os } from '../../shared/types';
import { AiAnalysis } from '../ai-analysis/entities/ai-analysis.entity';
import { Application } from '../applications/entities/application.entity';
import { Feedback } from '../feedbacks/entities/feedback.entity';
import { RecruitmentDevice } from '../recruitments/entities/recruitment-device.entity';
import { Recruitment } from '../recruitments/entities/recruitment.entity';
import { DeviceModel } from '../users/entities/device-model.entity';
import { User } from '../users/entities/user.entity';
import {
  ADMIN_EMAIL, ADMIN_PASSWORD, APP_FB, DAY, DEMO_LOCK, FB, MODELS, NOTI_FB, TESTER_PASSWORD, TESTERS, V1, V2,
} from './demo.data';

@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private log = new Logger('Demo');
  constructor(@InjectDataSource() private ds: DataSource) {}

  async onApplicationBootstrap() {
    const n = await this.ds.getRepository(User).count();
    if (n === 0) { this.log.log('빈 DB 라서 시연 데이터를 채웁니다.'); await this.reset(); }
  }

  /** R16: 이미 실행 중이면 막는다 (transaction 안의 advisory lock). */
  async reset() {
    await this.ds.transaction(async (m) => {
      const [{ ok }] = await m.query('select pg_try_advisory_xact_lock($1) as ok', [DEMO_LOCK]);
      if (!ok) throw new ConflictException('이미 초기화 중이에요.');
      await this.wipe(m);
      await this.seed(m);
    });
    return { ok: true };
  }

  private async wipe(m: EntityManager) {
    for (const t of ['ai_analyses', 'feedbacks', 'applications', 'recruitment_devices', 'recruitments']) await m.query(`delete from ${t}`);
    await m.query(`delete from users where role <> 'ADMIN'`);
    await m.query(`update users set device_type = null, device_model_id = null`);
    await m.query('delete from device_models');
  }

  private async seed(m: EntityManager) {
    const now = Date.now();
    const at = (days: number, hour = 10) => { const d = new Date(now + days * DAY); d.setMinutes(0, 0, 0); d.setHours(hour); return d; };

    // 관리자(없으면 만든다 — 초기화는 관리자 계정을 남긴다)
    let admin = await m.getRepository(User).findOne({ where: { role: 'ADMIN' } });
    if (!admin) admin = await m.getRepository(User).save({
      email: ADMIN_EMAIL, nickname: '운영 담당자', role: 'ADMIN', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    });

    const models = await m.getRepository(DeviceModel).save(MODELS.map(([os, modelName]) => ({ os, modelName, isActive: true })));
    const modelId = (name: string) => models.find((x) => x.modelName === name)!;

    const hash = await bcrypt.hash(TESTER_PASSWORD, 10);
    const users = await m.getRepository(User).save(TESTERS.map(([nickname, model], i) => ({
      email: `tester${String(i + 1).padStart(2, '0')}@example.com`, nickname, role: 'USER' as const, passwordHash: hash,
      deviceType: modelId(model).os, deviceModelId: modelId(model).id,
    })));
    const u = (i: number) => users[i - 1];
    const iosUsers = users.filter((x) => x.deviceType === 'IOS');
    const andUsers = users.filter((x) => x.deviceType === 'ANDROID');

    const ip = (n: number) => `203.0.113.${n}`;
    const mk = (title: string, description: string, kind: 'APP_FULL' | 'FEATURE', capacity: number, start: number, end: number, n: number, closed = false) => ({
      title, description, kind, capacity, startAt: at(start), endAt: at(end), isClosed: closed, createdBy: admin!.id,
      createdIp: ip(n), updatedIp: ip(n),
    });
    const [r1, r2, r3, r4, r5] = await m.getRepository(Recruitment).save([
      mk('앱 전체 테스트', '일정 관리 앱 "하루칸"의 첫 출시 전, 앱 전체를 2주 동안 써 보고 불편한 점을 알려 주세요. 일정 만들기, 월간·주간 보기, 설정 화면을 모두 사용해 주세요.', 'APP_FULL', 15, -5, 9, 11),
      mk('알림 기능 테스트', '일정 알림이 제시간에 오는지, 설정이 쉬운지 확인해 주세요. 알림 시간 설정, 반복 일정 알림, 절전 모드에서의 동작을 중점적으로 봅니다.', 'FEATURE', 20, -2, 12, 12),
      mk('일정 공유 테스트', '가족·친구와 일정을 공유하는 새 기능을 써 보는 테스트예요. 초대 보내기, 공유 일정 수정, 공유 해제를 확인해 주세요.', 'FEATURE', 10, 4, 18, 13),
      mk('반복 일정 테스트', '매주·매월 반복되는 일정을 만들고 수정하는 기능을 써 볼 테스터를 모집해요. 시작은 한 달 뒤입니다.', 'FEATURE', 15, 30, 45, 14),
      mk('캘린더 화면 개선 테스트', '새로 바뀐 캘린더 화면(iOS)을 써 보는 테스트예요. 담당자가 모집을 직접 마감했어요.', 'FEATURE', 12, 7, 21, 15, true),
    ]);

    const model = (n: string) => modelId(n);
    const dev = (rid: number, os: Os, scope: 'ALL' | 'MODEL', mid: number | null = null) => ({ recruitmentId: rid, os, scope, deviceModelId: mid, deviceCapacity: null });
    await m.getRepository(RecruitmentDevice).insert([
      dev(r1.id, 'ANDROID', 'ALL'), dev(r1.id, 'IOS', 'ALL'),
      dev(r2.id, 'ANDROID', 'ALL'), dev(r2.id, 'IOS', 'ALL'),
      dev(r3.id, 'ANDROID', 'ALL'), dev(r3.id, 'IOS', 'MODEL', model('아이폰 15').id),
      dev(r4.id, 'ANDROID', 'ALL'),
      dev(r5.id, 'IOS', 'ALL'),
    ]);

    // 신청: 신청 당시 기기를 그대로 복사해서 저장
    const appRows: Partial<Application>[] = [];
    const join = (rec: Recruitment, list: User[]) => list.forEach((usr, i) => appRows.push({
      recruitmentId: rec.id, userId: usr.id, deviceType: usr.deviceType!, deviceModel: modelName(usr),
      status: 'APPLIED', appliedAt: new Date(rec.startAt.getTime() - (1 + (i % 3)) * DAY),
    }));
    const modelName = (usr: User) => models.find((x) => x.id === usr.deviceModelId)!.modelName;
    const r1Users = [...andUsers.slice(0, 8), ...iosUsers.slice(0, 7)]; // 정확히 15명 → 자동 마감
    const r2Users = [...andUsers.slice(0, 5), ...iosUsers.slice(0, 5)]; // 10명
    // 일정 공유: Android 5명 + 아이폰 15 2명 = 7명(자리 3개 남음). 아이폰 14 사용자는 신청이 거절된다.
    const iphone15 = iosUsers.filter((x) => modelName(x) === '아이폰 15');
    const r3Users = [...andUsers.slice(5, 10), ...iphone15.slice(0, 2)];
    const r4Users = andUsers.slice(0, 4);
    const r5Users = iosUsers.slice(0, 5);
    join(r1, r1Users); join(r2, r2Users); join(r3, r3Users); join(r4, r4Users); join(r5, r5Users);
    // 취소 이력 1건(시작 전 모집글에서 취소 후 재신청 흐름을 보여 줌)
    const c = andUsers[10];
    appRows.push({ recruitmentId: r4.id, userId: c.id, deviceType: 'ANDROID', deviceModel: modelName(c), status: 'CANCELLED', appliedAt: at(-3), cancelledAt: at(-2) });
    await m.getRepository(Application).insert(appRows as any);

    // 피드백 30건: 앱 전체 10 + 알림 20 (나머지 모집글은 0건 → "분석 불가" 시연)
    const fb: Partial<Feedback>[] = [];
    const put = (rec: Recruitment, list: User[], texts: FB[]) => texts.forEach(([type, title, content], i) => fb.push({
      recruitmentId: rec.id, userId: list[i % list.length].id, type, title, content,
      createdAt: new Date(now - (texts.length - i) * 5 * 3_600_000),
    }));
    put(r1, r1Users, APP_FB);
    put(r2, r2Users, NOTI_FB);
    await m.getRepository(Feedback).insert(fb as any);

    await m.getRepository(AiAnalysis).insert([
      { recruitmentId: r2.id, versionNo: 1, result: V1, feedbackCount: 12, modelName: 'gpt-4o-mini', createdBy: admin.id, createdAt: new Date(now - 26 * 3_600_000) },
      { recruitmentId: r2.id, versionNo: 2, result: V2, feedbackCount: 20, modelName: 'gpt-4o-mini', createdBy: admin.id, createdAt: new Date(now - 3 * 3_600_000) },
    ]);
  }
}
