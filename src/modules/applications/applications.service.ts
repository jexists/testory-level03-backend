import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MSG, OS_LABEL } from '../../shared/constants/messages';
import { deviceLabel } from '../../shared/utils/device-label.util';
import { RecruitmentDevice } from '../recruitments/entities/recruitment-device.entity';
import { Recruitment } from '../recruitments/entities/recruitment.entity';
import { User } from '../users/entities/user.entity';
import { Application } from './entities/application.entity';

@Injectable()
export class ApplicationsService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  /** R1·R3·R4·R5·R6 — 모집글 행을 잠가서 동시에 몰려도 정원을 넘지 않는다. */
  async apply(recruitmentId: number, userId: number) {
    return this.ds.transaction(async (m) => {
      const rec = await m.getRepository(Recruitment).findOne({ where: { id: recruitmentId }, lock: { mode: 'pessimistic_write' } });
      if (!rec || rec.deletedAt) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
      if (rec.isClosed) throw new BadRequestException('마감된 모집글이에요.');
      if (rec.startAt.getTime() <= Date.now()) throw new BadRequestException('테스트가 이미 시작되어 신청할 수 없어요.');
      const apps = m.getRepository(Application);
      if (await apps.findOne({ where: { recruitmentId, userId, status: 'APPLIED' } }))
        throw new ConflictException('이미 신청한 모집글이에요.');
      const user = await m.getRepository(User).findOne({ where: { id: userId }, relations: { deviceModel: true } });
      if (!user?.deviceType || !user.deviceModelId || !user.deviceModel)
        throw new BadRequestException('마이페이지에서 내 기기를 먼저 등록해 주세요.');
      const conds = await m.getRepository(RecruitmentDevice).find({ where: { recruitmentId }, relations: { deviceModel: true }, order: { id: 'ASC' } });
      const ok = conds.some((c) => c.os === user.deviceType && (c.scope === 'ALL' || c.deviceModelId === user.deviceModelId));
      if (!ok) {
        const labels = conds.map((c) => (c.scope === 'ALL' ? OS_LABEL[c.os] : deviceLabel(c)));
        throw new BadRequestException(`이 모집은 ${labels.join(', ')}만 받아요.`);
      }
      const n = await apps.count({ where: { recruitmentId, status: 'APPLIED' } });
      if (n >= rec.capacity) throw new BadRequestException('자리가 모두 찼어요.');
      // R6: 신청 당시 기기를 서버가 내 정보에서 읽어 복사한다.
      return apps.save(apps.create({
        recruitmentId, userId, deviceType: user.deviceType, deviceModel: user.deviceModel.modelName, status: 'APPLIED',
      }));
    });
  }

  /** R4·R15 — 본인 신청만, 시작 전에만 취소. */
  async cancel(id: number, userId: number) {
    return this.ds.transaction(async (m) => {
      const app = await m.getRepository(Application).findOne({ where: { id } });
      if (!app) throw new NotFoundException('찾을 수 없는 신청이에요.');
      if (app.userId !== userId) throw new ForbiddenException('본인의 신청만 취소할 수 있어요.');
      const rec = await m.getRepository(Recruitment).findOne({ where: { id: app.recruitmentId }, lock: { mode: 'pessimistic_write' } });
      if (!rec || rec.deletedAt) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
      const fresh = await m.getRepository(Application).findOneOrFail({ where: { id } });
      if (fresh.status !== 'APPLIED') throw new BadRequestException('이미 취소된 신청이에요.');
      if (rec.startAt.getTime() <= Date.now()) throw new BadRequestException('테스트가 이미 시작되어 취소할 수 없어요.');
      await m.getRepository(Application).update(id, { status: 'CANCELLED', cancelledAt: new Date() });
      return { ok: true };
    });
  }

  async mine(userId: number) {
    const rows = await this.ds.getRepository(Application).createQueryBuilder('a')
      .innerJoinAndSelect('a.recruitment', 'r').where('a.user_id = :userId and r.deleted_at is null', { userId })
      .orderBy('a.id', 'DESC').getMany();
    const now = Date.now();
    return rows.map((a) => ({
      id: a.id, status: a.status, deviceType: a.deviceType, deviceModel: a.deviceModel,
      appliedAt: a.appliedAt, cancelledAt: a.cancelledAt,
      recruitment: { id: a.recruitment.id, title: a.recruitment.title, startAt: a.recruitment.startAt, endAt: a.recruitment.endAt },
      canCancel: a.status === 'APPLIED' && a.recruitment.startAt.getTime() > now,
    }));
  }

  /** A4: 모집글별 신청자 + 그 사람이 이 모집글에 쓴 피드백 수(그때그때 COUNT) */
  async applicants(recruitmentId: number, sort?: string) {
    const rec = await this.ds.getRepository(Recruitment).findOne({ where: { id: recruitmentId } });
    if (!rec) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
    const order = sort === 'feedback' ? 'feedback_count desc, a.applied_at asc' : 'a.applied_at desc';
    const rows = await this.ds.query(
      `select a.id, u.nickname, a.device_type as "deviceType", a.device_model as "deviceModel", a.status,
              a.applied_at as "appliedAt", a.cancelled_at as "cancelledAt",
              (select count(*)::int from feedbacks f where f.recruitment_id = a.recruitment_id and f.user_id = a.user_id) as feedback_count
         from applications a join users u on u.id = a.user_id
        where a.recruitment_id = $1 order by ${order}`,
      [recruitmentId],
    );
    return rows.map((r: any) => ({ ...r, feedbackCount: r.feedback_count, feedback_count: undefined }));
  }
}
