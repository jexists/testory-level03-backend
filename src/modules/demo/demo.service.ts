import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { AppError } from '../../common/app-error';
import { ApplicationStatus, DeviceScope, Role } from '../../common/enums';
import { MSG } from '../../common/messages';
import type { Env } from '../../config/env.schema';
import { AiAnalysis } from '../ai-analyses/ai-analysis.entity';
import { Application } from '../applications/application.entity';
import { Feedback } from '../feedbacks/feedback.entity';
import { RecruitmentDevice } from '../recruitments/recruitment-device.entity';
import { defaultFeedbackDueAt } from '../recruitments/recruitment-rules';
import { Recruitment } from '../recruitments/recruitment.entity';
import { DeviceModel } from '../users/device-model.entity';
import { User } from '../users/user.entity';
import { DEMO_ADMIN, DEMO_ANALYSES, DEMO_FEEDBACKS, DEMO_RECRUITMENTS, DEMO_TESTERS, testerEmail } from './demo.data';

/** 이 값으로 PostgreSQL advisory lock 을 잡아 시연 초기화가 동시에 두 번 돌지 않게 한다. (R16) */
const DEMO_LOCK_KEY = 74_201_025;
export const DEMO_DEFAULT_PASSWORD = 'testory-demo-1234';
const DAY = 86_400_000;

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 운영에서는 DEMO_SEED_ENABLED=true 이고 DEMO_PASSWORD 를 직접 정했을 때만 허용한다. */
  assertAllowed() {
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const enabled = this.config.get('DEMO_SEED_ENABLED', { infer: true });
    const password = this.config.get('DEMO_PASSWORD', { infer: true });
    if (isProd && (!enabled || !password)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'DEMO_DISABLED', MSG.DEMO_DISABLED);
    }
  }

  private demoPassword(): string {
    return this.config.get('DEMO_PASSWORD', { infer: true }) || DEMO_DEFAULT_PASSWORD;
  }

  /**
   * 시연 데이터를 완전히 지우고 다시 만든다. 관리자 계정은 남긴다.
   * 날짜는 실행 시점 기준으로 계산하므로 언제 눌러도 마감/진행/미래 상태가 그대로 나온다.
   */
  async reset() {
    this.assertAllowed();
    const runner = this.ds.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const [{ ok }] = await runner.query('SELECT pg_try_advisory_lock($1) AS ok', [DEMO_LOCK_KEY]);
      if (!ok) throw new AppError(HttpStatus.CONFLICT, 'DEMO_RUNNING', MSG.DEMO_RUNNING);
      locked = true;

      await runner.startTransaction();
      try {
        const counts = await this.rebuild(runner.manager);
        await runner.commitTransaction();
        this.logger.log(`demo data rebuilt: ${JSON.stringify(counts)}`);
        return counts;
      } catch (e) {
        await runner.rollbackTransaction();
        throw e;
      }
    } finally {
      // 연결이 끊긴 경우에도 원래 오류가 가려지지 않게 한다. (advisory lock 은 연결이 닫히면 함께 풀린다)
      if (locked && !runner.isReleased) {
        await runner.query('SELECT pg_advisory_unlock($1)', [DEMO_LOCK_KEY]).catch(() => undefined);
      }
      if (!runner.isReleased) await runner.release();
    }
  }

  private async rebuild(m: DataSource['manager']) {
    const now = Date.now();
    // ai_analyses 는 평소에 지울 수 없는데, 초기화 트랜잭션 안에서만 삭제를 허용한다.
    await m.query(`SELECT set_config('testory.demo_reset', 'on', true)`);
    for (const e of [AiAnalysis, Feedback, Application, RecruitmentDevice, Recruitment]) {
      await m.createQueryBuilder().delete().from(e).execute();
    }
    await m.createQueryBuilder().delete().from(User).where('role <> :admin', { admin: Role.ADMIN }).execute();

    // 기기 모델 목록은 기본값을 보장한다(마이그레이션에서 이미 넣어 두었고, 지워졌다면 다시 채운다).
    const modelRepo = m.getRepository(DeviceModel);
    const models = await modelRepo.find();
    const byName = new Map(models.map((x) => [x.modelName, x]));
    for (const t of DEMO_TESTERS) {
      if (!byName.has(t.model)) throw new Error(`기기 모델 목록에 없는 모델이에요: ${t.model}`);
    }

    // 관리자 1명은 없을 때만 만든다(있으면 그대로 둔다).
    const userRepo = m.getRepository(User);
    let admin = await userRepo.findOneBy({ role: Role.ADMIN });
    const hash = await bcrypt.hash(this.demoPassword(), 10);
    if (!admin) {
      admin = await userRepo.save(
        userRepo.create({ email: DEMO_ADMIN.email, nickname: DEMO_ADMIN.nickname, passwordHash: hash, role: Role.ADMIN, deviceType: null, deviceModelId: null }),
      );
    }

    const testers = await userRepo.save(
      DEMO_TESTERS.map((t, i) =>
        userRepo.create({
          email: testerEmail(i),
          nickname: t.nickname,
          passwordHash: hash,
          role: Role.USER,
          deviceType: t.os,
          deviceModelId: byName.get(t.model)!.id,
        }),
      ),
    );

    const recruitments: Recruitment[] = [];
    for (const d of DEMO_RECRUITMENTS) {
      const endAt = new Date(now + d.endInDays * DAY);
      const r = await m.getRepository(Recruitment).save(
        m.getRepository(Recruitment).create({
          title: d.title,
          description: d.description,
          kind: d.kind,
          capacity: d.capacity,
          startAt: new Date(now + d.startInDays * DAY),
          endAt,
          feedbackDueAt: defaultFeedbackDueAt(endAt),
          testStartedAt: d.filledDaysAgo != null ? new Date(now - d.filledDaysAgo * DAY) : null,
          analysisReviewedAt: null,
          isClosed: d.isClosed ?? false,
          createdBy: admin.id,
          createdIp: d.ip,
          updatedIp: d.ip,
          deletedAt: null,
          deletedIp: null,
        }),
      );
      recruitments.push(r);
      await m.getRepository(RecruitmentDevice).insert(
        d.devices.map((c) => ({
          recruitmentId: r.id,
          os: c.os,
          scope: c.scope as DeviceScope,
          deviceModelId: c.scope === 'MODEL' ? byName.get(c.model!)!.id : null,
          deviceCapacity: null,
        })),
      );

      const startedAgo = Math.max(-d.startInDays, d.filledDaysAgo ?? 0, 0) + 1;
      const apps = [
        ...(d.cancelled ?? []).map((idx, n) => ({ idx, status: ApplicationStatus.CANCELLED, offset: n })),
        ...d.applicants.map((idx, n) => ({ idx, status: ApplicationStatus.APPLIED, offset: n + 1 })),
      ];
      await m.getRepository(Application).insert(
        apps.map((a) => {
          const u = testers[a.idx];
          const appliedAt = new Date(now - (startedAgo + 1) * DAY + a.offset * 3_600_000);
          return {
            recruitmentId: r.id,
            userId: u.id,
            deviceType: u.deviceType!,
            deviceModel: DEMO_TESTERS[a.idx].model,
            status: a.status,
            appliedAt,
            cancelledAt: a.status === ApplicationStatus.CANCELLED ? new Date(appliedAt.getTime() + 3_600_000) : null,
          };
        }),
      );
    }

    // 피드백 마감이 지난 글의 피드백은 마감 전에 쓴 것으로 만든다.
    await m.getRepository(Feedback).insert(
      DEMO_FEEDBACKS.map((f, i) => {
        const base = Math.min(now, recruitments[f.recruitmentIndex].feedbackDueAt.getTime() - 3_600_000);
        return {
          recruitmentId: recruitments[f.recruitmentIndex].id,
          userId: testers[f.tester].id,
          type: f.type,
          title: f.title,
          content: f.content,
          createdAt: new Date(base - f.daysAgo * DAY - i * 60_000),
        };
      }),
    );

    const alarm = recruitments[1];
    await m.getRepository(AiAnalysis).insert(
      DEMO_ANALYSES.map((a) => ({
        recruitmentId: alarm.id,
        versionNo: a.versionNo,
        result: a.result,
        feedbackCount: a.feedbackCount,
        modelName: 'demo-seed',
        createdBy: admin!.id,
        createdAt: new Date(now - a.daysAgo * DAY),
      })),
    );

    return {
      testers: testers.length,
      recruitments: recruitments.length,
      feedbacks: DEMO_FEEDBACKS.length,
      analyses: DEMO_ANALYSES.length,
    };
  }
}
