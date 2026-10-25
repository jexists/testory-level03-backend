import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../common/app-error';
import { ApplicationStatus } from '../../common/enums';
import { MSG } from '../../common/messages';
import { Application } from './application.entity';
import { RecruitmentDevice } from '../recruitments/recruitment-device.entity';
import { deviceMatches, describeAllowed, type StoredCondition } from '../recruitments/recruitment-rules';
import { RecruitmentsService } from '../recruitments/recruitments.service';
import { User } from '../users/user.entity';
import { Recruitment } from '../recruitments/recruitment.entity';
import { Feedback } from '../feedbacks/feedback.entity';

export type ApplicationSort = 'feedback_desc' | 'applied_desc';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly recruitments: RecruitmentsService,
  ) {}

  /**
   * 신청하기. 모집글 행을 잠근 트랜잭션 안에서 규칙을 모두 확인하므로
   * 동시에 몰려도 정원(R1)이 넘지 않고 같은 사람이 두 번 신청되지도 않는다(R3).
   * 기기 값은 요청이 아니라 로그인한 사용자의 내 정보에서 읽어 복사한다. (R6)
   */
  async apply(recruitmentId: number, user: User) {
    try {
      return await this.ds.transaction(async (m) => {
        const r = await this.recruitments.lockActiveOrThrow(m, recruitmentId);
        const now = new Date();
        if (now.getTime() >= r.startAt.getTime()) throw badRequest('RECRUITMENT_STARTED', MSG.STARTED_CANNOT_APPLY);
        if (r.isClosed) throw conflict('RECRUITMENT_CLOSED', MSG.RECRUITMENT_CLOSED);

        const repo = m.getRepository(Application);
        if (await repo.exists({ where: { recruitmentId, userId: user.id, status: ApplicationStatus.APPLIED } })) {
          throw conflict('ALREADY_APPLIED', MSG.ALREADY_APPLIED);
        }

        // R5: 내 기기 정보가 비어 있으면 신청 불가, 조건에 맞아야 신청 가능
        if (!user.deviceType || !user.deviceModelId || !user.deviceModel) {
          throw badRequest('DEVICE_REQUIRED', MSG.DEVICE_REQUIRED);
        }
        const rows = await m
          .getRepository(RecruitmentDevice)
          .createQueryBuilder('d')
          .leftJoinAndSelect('d.deviceModel', 'dm')
          .where('d.recruitmentId = :id', { id: recruitmentId })
          .getMany();
        const conditions: StoredCondition[] = rows.map((d) => ({
          os: d.os,
          scope: d.scope,
          deviceModelId: d.deviceModelId,
          modelName: d.deviceModel?.modelName,
        }));
        if (!deviceMatches({ os: user.deviceType, modelId: user.deviceModelId }, conditions)) {
          throw badRequest('DEVICE_NOT_ALLOWED', describeAllowed(conditions));
        }

        // R1: 정원을 넘겨 신청할 수 없다.
        if ((await this.recruitments.countParticipants(m, recruitmentId)) >= r.capacity) {
          throw conflict('CAPACITY_FULL', MSG.CAPACITY_FULL);
        }

        const saved = await repo.save(
          repo.create({
            recruitmentId,
            userId: user.id,
            deviceType: user.deviceType,
            deviceModel: user.deviceModel.modelName,
            status: ApplicationStatus.APPLIED,
            cancelledAt: null,
          }),
        );
        return this.toMine(saved, r);
      });
    } catch (e) {
      if (e instanceof QueryFailedError && (e.driverError as { code?: string })?.code === '23505') {
        throw conflict('ALREADY_APPLIED', MSG.ALREADY_APPLIED);
      }
      throw e;
    }
  }

  /** 취소하기: 본인 신청만(R15), 테스트 시작 전까지만(R4). 취소 기록은 남기고 상태만 바꾼다. */
  async cancel(applicationId: number, user: User) {
    const app = await this.ds.getRepository(Application).findOneBy({ id: applicationId });
    if (!app) throw notFound('APPLICATION_NOT_FOUND', MSG.APPLICATION_NOT_FOUND);
    if (app.userId !== user.id) throw forbidden('FORBIDDEN', MSG.FORBIDDEN_OWN_APPLICATION);

    return this.ds.transaction(async (m) => {
      const r = await this.recruitments.lockActiveOrThrow(m, app.recruitmentId);
      const fresh = await m.getRepository(Application).findOneByOrFail({ id: applicationId });
      if (fresh.status === ApplicationStatus.CANCELLED) {
        throw new AppError(HttpStatus.CONFLICT, 'ALREADY_CANCELLED', '이미 취소된 신청이에요.');
      }
      if (new Date().getTime() >= r.startAt.getTime()) throw badRequest('RECRUITMENT_STARTED', MSG.STARTED_CANNOT_CANCEL);
      fresh.status = ApplicationStatus.CANCELLED;
      fresh.cancelledAt = new Date();
      await m.getRepository(Application).save(fresh);
      return this.toMine(fresh, r);
    });
  }

  private toMine(a: Application, r: Recruitment) {
    return {
      id: a.id,
      status: a.status,
      deviceType: a.deviceType,
      deviceModel: a.deviceModel,
      appliedAt: a.appliedAt,
      cancelledAt: a.cancelledAt,
      canCancel: a.status === ApplicationStatus.APPLIED && Date.now() < r.startAt.getTime(),
      recruitment: { id: r.id, title: r.title, startAt: r.startAt, endAt: r.endAt },
    };
  }

  /** 내 신청 목록 (삭제된 글 제외, R11) */
  async listMine(userId: number) {
    const rows = await this.ds
      .getRepository(Application)
      .createQueryBuilder('a')
      .innerJoinAndMapOne('a.recruitment', Recruitment, 'r', 'r.id = a.recruitmentId AND r.deletedAt IS NULL')
      .where('a.userId = :userId', { userId })
      .orderBy('a.appliedAt', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .getMany();
    return rows.map((a) => this.toMine(a, a.recruitment as Recruitment));
  }

  /** 관리자: 모집글별 신청자 (사용자별 피드백 수는 그때그때 COUNT 로 센다) */
  async listApplicants(recruitmentId: number, sort: ApplicationSort) {
    const exists = await this.ds.getRepository(Recruitment).existsBy({ id: recruitmentId });
    if (!exists) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    const qb = this.ds
      .getRepository(Application)
      .createQueryBuilder('a')
      .innerJoin('a.user', 'u')
      .addSelect('u.nickname', 'nickname')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(*)')
            .from(Feedback, 'f')
            .where('f.recruitmentId = a.recruitmentId AND f.userId = a.userId'),
        'feedback_count',
      )
      .where('a.recruitmentId = :recruitmentId', { recruitmentId });
    if (sort === 'feedback_desc') qb.orderBy('feedback_count', 'DESC').addOrderBy('a.appliedAt', 'ASC');
    else qb.orderBy('a.appliedAt', 'DESC');
    const { entities, raw } = await qb.getRawAndEntities();
    return entities.map((a, i) => ({
      id: a.id,
      userId: a.userId,
      nickname: raw[i].nickname as string,
      deviceType: a.deviceType,
      deviceModel: a.deviceModel,
      appliedAt: a.appliedAt,
      cancelledAt: a.cancelledAt,
      status: a.status,
      feedbackCount: Number(raw[i].feedback_count),
    }));
  }
}
