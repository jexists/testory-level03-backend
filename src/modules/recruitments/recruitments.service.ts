import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { badRequest, notFound } from '../../common/app-error';
import { ApplicationStatus, DeviceScope, FeedbackType, Os } from '../../common/enums';
import { MSG } from '../../common/messages';
import { Application } from '../applications/application.entity';
import { AiAnalysis } from '../ai-analyses/ai-analysis.entity';
import { Feedback } from '../feedbacks/feedback.entity';
import { DeviceModel } from '../users/device-model.entity';
import { RecruitmentBodyDto } from './dto/recruitment.dto';
import { AdminRecruitmentListQueryDto, DeletedFilter, RecruitmentListQueryDto, StatusFilter } from './dto/query.dto';
import { RecruitmentDevice } from './recruitment-device.entity';
import {
  computeStage,
  computeStatus,
  defaultFeedbackDueAt,
  STAGES,
  toPublicStage,
  validateDeviceConditions,
  type KnownModel,
  type Stage,
} from './recruitment-rules';
import { Recruitment } from './recruitment.entity';

export interface DeviceConditionView {
  id: number;
  os: Os;
  scope: DeviceScope;
  deviceModelId: number | null;
  modelName: string | null;
  label: string;
}

const toDate = (v: unknown): Date | null => (v == null ? null : new Date(v as string));

const conditionLabel = (os: Os, scope: DeviceScope, modelName: string | null) =>
  scope === DeviceScope.ALL ? `${os === Os.ANDROID ? 'Android' : 'iOS'} 전체` : (modelName ?? '');

@Injectable()
export class RecruitmentsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** 삭제되지 않은 글 한 건을 불러온다. 없으면 "찾을 수 없는 모집글" (R11) */
  async getActiveOrThrow(id: number, manager: EntityManager = this.ds.manager): Promise<Recruitment> {
    const r = await manager
      .getRepository(Recruitment)
      .createQueryBuilder('r')
      .where('r.id = :id AND r.deletedAt IS NULL', { id })
      .getOne();
    if (!r) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    return r;
  }

  /** 정원·신청·정원 축소처럼 숫자가 엇갈리면 안 되는 작업은 이 행 잠금 안에서 한다. (R1, R10) */
  async lockActiveOrThrow(manager: EntityManager, id: number): Promise<Recruitment> {
    const r = await manager
      .getRepository(Recruitment)
      .createQueryBuilder('r')
      .setLock('pessimistic_write')
      .where('r.id = :id AND r.deletedAt IS NULL', { id })
      .getOne();
    if (!r) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    return r;
  }

  countParticipants(manager: EntityManager, recruitmentId: number): Promise<number> {
    return manager.getRepository(Application).countBy({ recruitmentId, status: ApplicationStatus.APPLIED });
  }

  async loadConditions(recruitmentIds: number[]): Promise<Map<number, DeviceConditionView[]>> {
    const map = new Map<number, DeviceConditionView[]>();
    if (recruitmentIds.length === 0) return map;
    const rows = await this.ds
      .getRepository(RecruitmentDevice)
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.deviceModel', 'm')
      .where('d.recruitmentId IN (:...ids)', { ids: recruitmentIds })
      .orderBy('d.os', 'ASC')
      .addOrderBy('d.scope', 'ASC')
      .addOrderBy('d.id', 'ASC')
      .getMany();
    for (const d of rows) {
      const view: DeviceConditionView = {
        id: d.id,
        os: d.os,
        scope: d.scope,
        deviceModelId: d.deviceModelId,
        modelName: d.deviceModel?.modelName ?? null,
        label: conditionLabel(d.os, d.scope, d.deviceModel?.modelName ?? null),
      };
      const list = map.get(d.recruitmentId) ?? [];
      list.push(view);
      map.set(d.recruitmentId, list);
    }
    return map;
  }

  private participantsSubQuery(qb: SelectQueryBuilder<Recruitment>): string {
    return qb
      .subQuery()
      .select('COUNT(*)')
      .from(Application, 'a')
      .where('a.recruitmentId = r.id')
      .andWhere(`a.status = '${ApplicationStatus.APPLIED}'`)
      .getQuery();
  }

  private feedbackSubQuery(qb: SelectQueryBuilder<Recruitment>): string {
    return qb.subQuery().select('COUNT(*)').from(Feedback, 'f').where('f.recruitmentId = r.id').getQuery();
  }

  /** 가장 최근 AI 분석 시각 (관리자 진행 단계 계산용) */
  private latestAnalysisSubQuery(qb: SelectQueryBuilder<Recruitment>): string {
    return qb.subQuery().select('MAX(an.createdAt)').from(AiAnalysis, 'an').where('an.recruitmentId = r.id').getQuery();
  }

  /** computeStage 와 같은 규칙을 SQL 로 옮긴 식. 관리자 목록의 단계 필터·단계별 개수에 쓴다. */
  private stageExpression(qb: SelectQueryBuilder<Recruitment>): string {
    const participants = this.participantsSubQuery(qb);
    const latest = `(${this.latestAnalysisSubQuery(qb)})`;
    return `CASE
      WHEN now() >= r.feedbackDueAt THEN CASE
        WHEN ${latest} IS NULL THEN 'FEEDBACK_DONE'
        WHEN r.analysisReviewedAt IS NOT NULL AND r.analysisReviewedAt >= ${latest} THEN 'DONE'
        ELSE 'ANALYZED' END
      WHEN now() >= LEAST(r.startAt, COALESCE(r.testStartedAt, r.startAt)) THEN 'TESTING'
      WHEN r.isClosed = true OR (${participants}) >= r.capacity THEN 'RECRUIT_CLOSED'
      ELSE 'RECRUITING' END`;
  }

  private baseListQuery(q: RecruitmentListQueryDto, admin: boolean) {
    const qb = this.ds.getRepository(Recruitment).createQueryBuilder('r');
    const participants = this.participantsSubQuery(qb);
    const feedbacks = this.feedbackSubQuery(qb);
    qb.addSelect(`(${participants})::int`, 'participants')
      .addSelect(`(${feedbacks})::int`, 'feedback_count')
      .addSelect(`(${this.latestAnalysisSubQuery(qb)})`, 'latest_analysis_at');

    if (q.os) {
      // 그 OS 조건이 있거나, 조건이 하나도 없는(모든 기기) 모집글
      const exists = qb
        .subQuery()
        .select('1')
        .from(RecruitmentDevice, 'd')
        .where('d.recruitmentId = r.id AND d.os = :os')
        .getQuery();
      const anyDevice = qb.subQuery().select('1').from(RecruitmentDevice, 'd2').where('d2.recruitmentId = r.id').getQuery();
      qb.andWhere(`(EXISTS ${exists} OR NOT EXISTS ${anyDevice})`, { os: q.os });
    }
    if (q.q?.trim()) qb.andWhere('r.title ILIKE :q', { q: `%${q.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` });
    if (q.status === StatusFilter.OPEN) {
      qb.andWhere(`r.isClosed = false AND r.startAt > now() AND r.testStartedAt IS NULL AND (${participants}) < r.capacity`);
    } else if (q.status === StatusFilter.CLOSED) {
      qb.andWhere(`(r.isClosed = true OR r.startAt <= now() OR r.testStartedAt IS NOT NULL OR (${participants}) >= r.capacity)`);
    }

    if (admin) {
      const deleted = (q as AdminRecruitmentListQueryDto).deleted ?? DeletedFilter.EXCLUDE;
      if (deleted === DeletedFilter.EXCLUDE) qb.andWhere('r.deletedAt IS NULL');
      if (deleted === DeletedFilter.ONLY) qb.andWhere('r.deletedAt IS NOT NULL');
    } else {
      qb.andWhere('r.deletedAt IS NULL');
    }
    return qb;
  }

  private toView(r: Recruitment, participants: number, feedbackCount: number | null, conditions: DeviceConditionView[]) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      kind: r.kind,
      capacity: r.capacity,
      startAt: r.startAt,
      endAt: r.endAt,
      feedbackDueAt: r.feedbackDueAt,
      testStartedAt: r.testStartedAt,
      isClosed: r.isClosed,
      participants,
      ...computeStatus({ ...r, participants }),
      // 테스터에게는 피드백 마감 뒤 단계를 하나로 묶어 보여 준다. 관리자 응답은 adminFields 가 덮어쓴다.
      stage: toPublicStage(computeStage({ ...r, participants, latestAnalysisAt: null })),
      devices: conditions,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ...(feedbackCount !== null ? { feedbackCount } : {}),
    };
  }

  async list(q: RecruitmentListQueryDto, admin = false) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;
    const qb = this.baseListQuery(q, admin);

    // 관리자: 단계 탭 숫자는 검색·삭제 조건만 반영하고, 목록은 고른 단계로 거른다.
    let stageCounts: Record<Stage, number> | undefined;
    if (admin) {
      const stage = this.stageExpression(qb);
      const rows: { stage: Stage; n: string }[] = await qb
        .clone()
        .select(stage, 'stage')
        .addSelect('COUNT(*)', 'n')
        .groupBy('1')
        .getRawMany();
      stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
      for (const row of rows) stageCounts[row.stage] = Number(row.n);
      const picked = (q as AdminRecruitmentListQueryDto).stage;
      if (picked) qb.andWhere(`(${stage}) = :stage`, { stage: picked });
      const bugs = qb
        .subQuery()
        .select('COUNT(*)')
        .from(Feedback, 'fb')
        .where(`fb.recruitmentId = r.id AND fb.type = '${FeedbackType.BUG}'`)
        .getQuery();
      const version = qb.subQuery().select('MAX(av.versionNo)').from(AiAnalysis, 'av').where('av.recruitmentId = r.id').getQuery();
      qb.addSelect(`(${bugs})::int`, 'bug_count').addSelect(`(${version})`, 'latest_version');
    }

    const total = await qb.clone().getCount();
    const { entities, raw } = await qb
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities();
    const conditions = await this.loadConditions(entities.map((e) => e.id));
    const items = entities.map((r, i) => ({
      ...this.toView(r, Number(raw[i].participants), Number(raw[i].feedback_count), conditions.get(r.id) ?? []),
      ...(admin
        ? {
            ...this.adminFields(r, Number(raw[i].participants), toDate(raw[i].latest_analysis_at)),
            bugCount: Number(raw[i].bug_count),
            latestAnalysisVersion: raw[i].latest_version == null ? null : Number(raw[i].latest_version),
          }
        : {}),
    }));
    return { items, total, page, limit, ...(stageCounts ? { stageCounts } : {}) };
  }

  async detail(id: number, admin = false, userId?: number) {
    const qb = this.ds.getRepository(Recruitment).createQueryBuilder('r').where('r.id = :id', { id });
    if (!admin) qb.andWhere('r.deletedAt IS NULL');
    const participants = this.participantsSubQuery(qb);
    const feedbacks = this.feedbackSubQuery(qb);
    qb.addSelect(`(${participants})::int`, 'participants')
      .addSelect(`(${feedbacks})::int`, 'feedback_count')
      .addSelect(`(${this.latestAnalysisSubQuery(qb)})`, 'latest_analysis_at');
    const { entities, raw } = await qb.getRawAndEntities();
    const r = entities[0];
    if (!r) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    const conditions = await this.loadConditions([r.id]);
    const mine = userId
      ? await this.ds
          .getRepository(Application)
          .findOneBy({ recruitmentId: r.id, userId, status: ApplicationStatus.APPLIED })
      : null;
    return {
      ...this.toView(r, Number(raw[0].participants), admin ? Number(raw[0].feedback_count) : null, conditions.get(r.id) ?? []),
      ...(admin ? this.adminFields(r, Number(raw[0].participants), toDate(raw[0].latest_analysis_at)) : {}),
      ...(userId ? { myApplication: mine ? { id: mine.id, status: mine.status, appliedAt: mine.appliedAt } : null } : {}),
    };
  }

  /** 관리자만 보는 값: 6단계 진행 단계, 분석 확인 시각, 기록용 IP */
  private adminFields(r: Recruitment, participants: number, latestAnalysisAt: Date | null) {
    return {
      stage: computeStage({ ...r, participants, latestAnalysisAt }),
      latestAnalysisAt,
      analysisReviewedAt: r.analysisReviewedAt,
      deletedAt: r.deletedAt,
      createdIp: r.createdIp,
      updatedIp: r.updatedIp,
      deletedIp: r.deletedIp,
    };
  }

  private async loadModels(manager: EntityManager): Promise<Map<number, KnownModel>> {
    const models = await manager.getRepository(DeviceModel).find();
    return new Map(models.map((m) => [m.id, m]));
  }

  /** 기간 검사 후 피드백 마감일을 정한다. 비우면 종료일 + 3일 */
  private resolvePeriod(dto: RecruitmentBodyDto): Date {
    if (!(dto.endAt.getTime() > dto.startAt.getTime())) throw badRequest('END_BEFORE_START', MSG.END_BEFORE_START);
    const feedbackDueAt = dto.feedbackDueAt ?? defaultFeedbackDueAt(dto.endAt);
    if (feedbackDueAt.getTime() < dto.endAt.getTime()) throw badRequest('FEEDBACK_DUE_BEFORE_END', MSG.FEEDBACK_DUE_BEFORE_END);
    return feedbackDueAt;
  }

  async create(dto: RecruitmentBodyDto, adminId: number, ip: string | null) {
    const feedbackDueAt = this.resolvePeriod(dto);
    const id = await this.ds.transaction(async (m) => {
      validateDeviceConditions(dto.devices, await this.loadModels(m));
      const saved = await m.getRepository(Recruitment).save(
        m.getRepository(Recruitment).create({
          title: dto.title,
          description: dto.description,
          kind: dto.kind,
          capacity: dto.capacity ?? 15,
          startAt: dto.startAt,
          endAt: dto.endAt,
          feedbackDueAt,
          isClosed: false,
          createdBy: adminId,
          createdIp: ip,
          updatedIp: ip,
          deletedAt: null,
          deletedIp: null,
        }),
      );
      await this.replaceDevices(m, saved.id, dto);
      return saved.id;
    });
    return this.detail(id, true);
  }

  async update(id: number, dto: RecruitmentBodyDto, ip: string | null) {
    const feedbackDueAt = this.resolvePeriod(dto);
    await this.ds.transaction(async (m) => {
      const r = await this.lockActiveOrThrow(m, id);
      const capacity = dto.capacity ?? r.capacity;
      // R10: 정원을 현재 참여자 수보다 작게 줄일 수 없다.
      const participants = await this.countParticipants(m, id);
      if (capacity < participants) {
        throw badRequest('CAPACITY_BELOW_PARTICIPANTS', MSG.CAPACITY_BELOW_PARTICIPANTS(participants));
      }
      // 이미 걸려 있던 조건의 비활성 모델은 그대로 유지할 수 있다.
      const existing = await m.getRepository(RecruitmentDevice).findBy({ recruitmentId: id });
      const keep = new Set(existing.map((d) => d.deviceModelId).filter((v): v is number => v != null));
      validateDeviceConditions(dto.devices, await this.loadModels(m), keep);

      // 정원을 참여자 수만큼 줄여 꽉 찼다면, 신청할 때와 같이 테스트를 바로 시작한다.
      const now = new Date();
      const fillsNow = !r.testStartedAt && participants > 0 && capacity <= participants && now < dto.startAt;
      await m.getRepository(Recruitment).update(
        { id },
        {
          title: dto.title,
          description: dto.description,
          kind: dto.kind,
          capacity,
          startAt: dto.startAt,
          endAt: dto.endAt,
          feedbackDueAt,
          ...(fillsNow ? { testStartedAt: now } : {}),
          updatedIp: ip,
        },
      );
      // 조건을 고쳐도 이미 한 신청은 그대로 남는다. (신청 표에는 조건이 복사되지 않으므로 영향 없음)
      await this.replaceDevices(m, id, dto);
    });
    return this.detail(id, true);
  }

  private async replaceDevices(m: EntityManager, recruitmentId: number, dto: RecruitmentBodyDto) {
    const repo = m.getRepository(RecruitmentDevice);
    await repo.delete({ recruitmentId });
    await repo.insert(
      dto.devices.map((d) => ({
        recruitmentId,
        os: d.os,
        scope: d.scope,
        deviceModelId: d.scope === DeviceScope.MODEL ? (d.deviceModelId ?? null) : null,
        deviceCapacity: null,
      })),
    );
  }

  /** R11: 삭제는 Soft Delete. 삭제 시각과 삭제한 곳 IP 만 기록하고 데이터는 남긴다. */
  async softDelete(id: number, ip: string | null) {
    const res = await this.ds
      .getRepository(Recruitment)
      .createQueryBuilder()
      .update()
      .set({ deletedAt: () => 'now()', deletedIp: ip })
      .where('id = :id AND deleted_at IS NULL', { id })
      .execute();
    if (!res.affected) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
  }

  /** 삭제한 글을 되살린다. 삭제되지 않은 글이면 "찾을 수 없는 모집글" */
  async restore(id: number, ip: string | null) {
    const res = await this.ds
      .getRepository(Recruitment)
      .createQueryBuilder()
      .update()
      .set({ deletedAt: null, deletedIp: null, updatedIp: ip })
      .where('id = :id AND deleted_at IS NOT NULL', { id })
      .execute();
    if (!res.affected) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    return this.detail(id, true);
  }

  async setClosed(id: number, isClosed: boolean, ip: string | null) {
    const res = await this.ds
      .getRepository(Recruitment)
      .createQueryBuilder()
      .update()
      .set({ isClosed, updatedIp: ip })
      .where('id = :id AND deleted_at IS NULL', { id })
      .execute();
    if (!res.affected) throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    return this.detail(id, true);
  }
}
