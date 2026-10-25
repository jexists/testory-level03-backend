import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationStatus, FeedbackType } from '../../common/enums';
import { Application } from '../applications/application.entity';
import { Feedback } from '../feedbacks/feedback.entity';
import { computeStatus } from '../recruitments/recruitment-rules';
import { Recruitment } from '../recruitments/recruitment.entity';

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** 삭제되지 않은 모집글만 센다. (R11) 모든 숫자는 저장해 둔 값이 아니라 그때그때 COUNT 한 값이다. */
  async summary() {
    const participants = await this.ds
      .getRepository(Application)
      .createQueryBuilder('a')
      .innerJoin(Recruitment, 'r', 'r.id = a.recruitmentId AND r.deletedAt IS NULL')
      .where('a.status = :s', { s: ApplicationStatus.APPLIED })
      .select('COUNT(DISTINCT a.userId)', 'n')
      .getRawOne<{ n: string }>();

    const feedbackRows = await this.ds
      .getRepository(Feedback)
      .createQueryBuilder('f')
      .innerJoin(Recruitment, 'r', 'r.id = f.recruitmentId AND r.deletedAt IS NULL')
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE f.type = :bug)', 'bugs')
      .setParameter('bug', FeedbackType.BUG)
      .getRawOne<{ total: string; bugs: string }>();

    const qb = this.ds.getRepository(Recruitment).createQueryBuilder('r').where('r.deletedAt IS NULL');
    const partSub = qb.subQuery().select('COUNT(*)').from(Application, 'a').where(`a.recruitmentId = r.id AND a.status = '${ApplicationStatus.APPLIED}'`).getQuery();
    const fbSub = qb.subQuery().select('COUNT(*)').from(Feedback, 'f').where('f.recruitmentId = r.id').getQuery();
    const { entities, raw } = await qb
      .addSelect(`(${partSub})::int`, 'participants')
      .addSelect(`(${fbSub})::int`, 'feedback_count')
      .orderBy('r.createdAt', 'DESC')
      .getRawAndEntities();

    return {
      participants: Number(participants?.n ?? 0),
      feedbacks: Number(feedbackRows?.total ?? 0),
      bugs: Number(feedbackRows?.bugs ?? 0),
      recruitments: entities.map((r, i) => {
        const p = Number(raw[i].participants);
        return {
          id: r.id,
          title: r.title,
          participants: p,
          feedbackCount: Number(raw[i].feedback_count),
          capacity: r.capacity,
          status: computeStatus({ ...r, participants: p }).status,
        };
      }),
    };
  }
}
