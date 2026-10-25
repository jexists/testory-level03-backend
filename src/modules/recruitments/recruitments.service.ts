import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { MSG, OS_LABEL } from '../../shared/constants/messages';
import type { Os } from '../../shared/types';
import { deviceLabel } from '../../shared/utils/device-label.util';
import { Application } from '../applications/entities/application.entity';
import { Feedback } from '../feedbacks/entities/feedback.entity';
import { DeviceModel } from '../users/entities/device-model.entity';
import { DeviceConditionDto } from './dto/device-condition.dto';
import { RecruitmentDto } from './dto/recruitment.dto';
import { RecruitmentDevice } from './entities/recruitment-device.entity';
import { Recruitment } from './entities/recruitment.entity';

@Injectable()
export class RecruitmentsService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  /** R2: 정원이 차면 자동 마감으로 보이고, 취소로 자리가 나면 다시 모집 중. 시작 후에는 신청 불가라 마감으로 보인다. */
  async toViews(list: Recruitment[], admin = false) {
    if (!list.length) return [];
    const rows: { rid: number; n: string }[] = await this.ds.query(
      `select recruitment_id as rid, count(*) n from applications where status='APPLIED' and recruitment_id = any($1) group by 1`,
      [list.map((r) => r.id)],
    );
    const counts = new Map(rows.map((r) => [r.rid, Number(r.n)]));
    const now = Date.now();
    return list.map((r) => {
      const participantCount = counts.get(r.id) ?? 0;
      const closedReason = r.isClosed ? 'MANUAL' : participantCount >= r.capacity ? 'FULL' : r.startAt.getTime() <= now ? 'STARTED' : null;
      return {
        id: r.id, title: r.title, description: r.description, kind: r.kind, capacity: r.capacity,
        startAt: r.startAt, endAt: r.endAt, isClosed: r.isClosed,
        participantCount, remaining: Math.max(r.capacity - participantCount, 0),
        status: closedReason ? 'CLOSED' : 'OPEN', closedReason,
        devices: (r.devices ?? []).sort((a, b) => a.id - b.id).map((d) => ({
          os: d.os, scope: d.scope, deviceModelId: d.deviceModelId, label: deviceLabel(d),
        })),
        createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
        ...(admin ? { createdIp: r.createdIp, updatedIp: r.updatedIp, deletedIp: r.deletedIp } : {}),
      };
    });
  }

  private repo(m?: EntityManager) { return (m ?? this.ds.manager).getRepository(Recruitment); }

  async list(q: { device?: string; status?: string; q?: string }, admin = false, includeDeleted = false) {
    const qb = this.repo().createQueryBuilder('r')
      .leftJoinAndSelect('r.devices', 'd').leftJoinAndSelect('d.deviceModel', 'm');
    if (!(admin && includeDeleted)) qb.andWhere('r.deleted_at is null');
    if (q.device === 'ANDROID' || q.device === 'IOS')
      qb.andWhere('exists (select 1 from recruitment_devices x where x.recruitment_id = r.id and x.os = :os)', { os: q.device });
    if (q.q?.trim()) qb.andWhere('r.title ilike :t', { t: `%${q.q.trim().replace(/[%_]/g, '\\$&')}%` });
    qb.orderBy('r.id', 'DESC');
    let views = await this.toViews(await qb.getMany(), admin);
    if (q.status === 'OPEN' || q.status === 'CLOSED') views = views.filter((v) => v.status === q.status);
    return admin ? views : views.sort((a, b) => Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED'));
  }

  async findOne(id: number, admin = false, m?: EntityManager) {
    const r = await this.repo(m).findOne({ where: { id }, relations: { devices: { deviceModel: true } } });
    if (!r || (!admin && r.deletedAt)) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
    return r;
  }

  async detail(id: number, user: AuthUser | null, admin = false) {
    const r = await this.findOne(id, admin);
    const [view] = await this.toViews([r], admin);
    if (!user || admin) return { ...view, myApplication: null, myFeedbacks: [] };
    const m = this.ds.manager;
    const myApplication = await m.getRepository(Application).findOne({ where: { recruitmentId: id, userId: user.id, status: 'APPLIED' } });
    const myFeedbacks = await m.getRepository(Feedback).find({ where: { recruitmentId: id, userId: user.id }, order: { id: 'DESC' } });
    return { ...view, myApplication, myFeedbacks };
  }

  /** R8: 겹치지 않는 기기 조건 */
  private async validateDevices(m: EntityManager, devs: DeviceConditionDto[]) {
    if (!devs?.length) throw new BadRequestException(MSG.NEED_DEVICE_COND);
    const models = new Map<number, DeviceModel>();
    const ids = devs.filter((d) => d.scope === 'MODEL').map((d) => d.deviceModelId);
    if (ids.some((i) => !i)) throw new BadRequestException(MSG.PICK_MODEL);
    (await m.getRepository(DeviceModel).find({ where: { id: In(ids as number[]), isActive: true } })).forEach((x) => models.set(x.id, x));
    const allOs = new Set<Os>(devs.filter((d) => d.scope === 'ALL').map((d) => d.os));
    const seen = new Set<string>();
    for (const d of devs) {
      const key = d.scope === 'ALL' ? `A:${d.os}` : `M:${d.deviceModelId}`;
      if (seen.has(key)) throw new BadRequestException('같은 기기 조건을 두 번 넣을 수 없어요.');
      seen.add(key);
      if (d.scope === 'MODEL') {
        const model = models.get(d.deviceModelId as number);
        if (!model || model.os !== d.os) throw new BadRequestException(MSG.PICK_MODEL);
        if (allOs.has(d.os))
          throw new BadRequestException(`${OS_LABEL[d.os]} 전체를 허용했으니 ${OS_LABEL[d.os]} 모델은 따로 고를 필요가 없어요.`);
      }
    }
  }

  private checkDates(dto: RecruitmentDto) {
    if (new Date(dto.endAt).getTime() <= new Date(dto.startAt).getTime())
      throw new BadRequestException('종료일은 시작일보다 늦어야 해요.');
  }

  private rows(id: number, devs: DeviceConditionDto[]) {
    return devs.map((d) => ({
      recruitmentId: id, os: d.os, scope: d.scope,
      deviceModelId: d.scope === 'MODEL' ? d.deviceModelId! : null, deviceCapacity: null,
    }));
  }

  async create(dto: RecruitmentDto, adminId: number, ip: string) {
    this.checkDates(dto);
    const id = await this.ds.transaction(async (m) => {
      await this.validateDevices(m, dto.devices);
      const r = await m.getRepository(Recruitment).save({
        title: dto.title.trim(), description: dto.description?.trim() ?? '', kind: dto.kind,
        capacity: dto.capacity ?? 15, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt),
        createdBy: adminId, createdIp: ip, updatedIp: ip,
      });
      await m.getRepository(RecruitmentDevice).insert(this.rows(r.id, dto.devices));
      return r.id;
    });
    return this.detail(id, null, true);
  }

  async update(id: number, dto: RecruitmentDto, ip: string) {
    this.checkDates(dto);
    await this.ds.transaction(async (m) => {
      const locked = await m.getRepository(Recruitment).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!locked || locked.deletedAt) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
      const n = await m.getRepository(Application).count({ where: { recruitmentId: id, status: 'APPLIED' } });
      const capacity = dto.capacity ?? locked.capacity;
      if (capacity < n) throw new BadRequestException(`이미 ${n}명이 참여 중이라 ${n}명보다 줄일 수 없어요.`);
      await this.validateDevices(m, dto.devices);
      await m.getRepository(RecruitmentDevice).delete({ recruitmentId: id });
      await m.getRepository(RecruitmentDevice).insert(this.rows(id, dto.devices));
      await m.getRepository(Recruitment).update(id, {
        title: dto.title.trim(), description: dto.description?.trim() ?? '', kind: dto.kind, capacity,
        startAt: new Date(dto.startAt), endAt: new Date(dto.endAt), updatedIp: ip,
      });
    });
    return this.detail(id, null, true);
  }

  /** R11: Soft Delete — 삭제 시각과 IP 만 기록하고 데이터는 남긴다. */
  async remove(id: number, ip: string) {
    const res = await this.repo().createQueryBuilder().update()
      .set({ deletedAt: () => 'now()', deletedIp: ip, updatedIp: ip })
      .where('id = :id and deleted_at is null', { id }).execute();
    if (!res.affected) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
    return { ok: true };
  }

  async setClosed(id: number, closed: boolean, ip: string) {
    const r = await this.findOne(id);
    await this.repo().update(r.id, { isClosed: closed, updatedIp: ip });
    return this.detail(id, null, true);
  }
}
