import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { badRequest, forbidden } from '../../common/app-error';
import { ApplicationStatus } from '../../common/enums';
import { MSG } from '../../common/messages';
import { Application } from '../applications/application.entity';
import { feedbackWindow } from '../recruitments/recruitment-rules';
import { Recruitment } from '../recruitments/recruitment.entity';
import { RecruitmentsService } from '../recruitments/recruitments.service';
import { User } from '../users/user.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { AdminFeedbackQueryDto, FeedbackSort, MyFeedbackQueryDto } from './dto/feedback-query.dto';
import { Feedback } from './feedback.entity';

@Injectable()
export class FeedbacksService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly recruitments: RecruitmentsService,
  ) {}

  /**
   * R9: 삭제되지 않은 모집글에서 "참여 중"인 사람만 쓸 수 있다. 유형은 반드시 골라야 한다.
   * 테스트가 시작된 뒤부터 피드백 마감일 전까지만 받는다.
   */
  async create(recruitmentId: number, user: User, dto: CreateFeedbackDto) {
    const r = await this.recruitments.getActiveOrThrow(recruitmentId); // R11: 삭제된 글은 받지 않는다
    const joined = await this.ds
      .getRepository(Application)
      .existsBy({ recruitmentId, userId: user.id, status: ApplicationStatus.APPLIED });
    if (!joined) throw forbidden('NOT_PARTICIPANT', MSG.FEEDBACK_NOT_PARTICIPANT);
    const window = feedbackWindow(r);
    if (window === 'NOT_STARTED') throw badRequest('FEEDBACK_NOT_STARTED', MSG.FEEDBACK_NOT_STARTED);
    if (window === 'CLOSED') throw badRequest('FEEDBACK_CLOSED', MSG.FEEDBACK_CLOSED);

    const repo = this.ds.getRepository(Feedback);
    const saved = await repo.save(
      repo.create({ recruitmentId, userId: user.id, type: dto.type, title: dto.title, content: dto.content }),
    );
    return this.toMine(saved);
  }

  private toMine(f: Feedback) {
    return { id: f.id, recruitmentId: f.recruitmentId, type: f.type, title: f.title, content: f.content, createdAt: f.createdAt };
  }

  /** 내 피드백 (삭제된 모집글의 것은 보이지 않는다) */
  async listMine(userId: number, q: MyFeedbackQueryDto) {
    const qb = this.ds
      .getRepository(Feedback)
      .createQueryBuilder('f')
      .innerJoinAndMapOne('f.recruitment', Recruitment, 'r', 'r.id = f.recruitmentId AND r.deletedAt IS NULL')
      .where('f.userId = :userId', { userId });
    if (q.recruitmentId) qb.andWhere('f.recruitmentId = :rid', { rid: q.recruitmentId });
    const rows = await qb.orderBy('f.createdAt', 'DESC').addOrderBy('f.id', 'DESC').getMany();
    return rows.map((f) => ({
      ...this.toMine(f),
      recruitment: { id: (f.recruitment as Recruitment).id, title: (f.recruitment as Recruitment).title },
    }));
  }

  /** 관리자: 전체 피드백. 작성자별 피드백 수는 저장하지 않고 COUNT 로 센다. */
  async listAdmin(q: AdminFeedbackQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.ds
      .getRepository(Feedback)
      .createQueryBuilder('f')
      .innerJoin(Recruitment, 'r', 'r.id = f.recruitmentId AND r.deletedAt IS NULL')
      .innerJoin(User, 'u', 'u.id = f.userId')
      .addSelect('r.title', 'recruitment_title')
      .addSelect('u.nickname', 'nickname')
      .addSelect((sub) => {
        const inner = sub.select('COUNT(*)').from(Feedback, 'f2').innerJoin(Recruitment, 'r2', 'r2.id = f2.recruitmentId AND r2.deletedAt IS NULL');
        return inner.where('f2.userId = f.userId');
      }, 'author_count');
    if (q.type) qb.andWhere('f.type = :type', { type: q.type });
    if (q.recruitmentId) qb.andWhere('f.recruitmentId = :rid', { rid: q.recruitmentId });

    const total = await qb.clone().getCount();
    if (q.sort === FeedbackSort.AUTHOR_COUNT_DESC) qb.orderBy('author_count', 'DESC').addOrderBy('f.createdAt', 'DESC');
    else qb.orderBy('f.createdAt', 'DESC');
    const { entities, raw } = await qb
      .addOrderBy('f.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities();
    return {
      total,
      page,
      limit,
      items: entities.map((f, i) => ({
        ...this.toMine(f),
        recruitmentTitle: raw[i].recruitment_title as string,
        userId: f.userId,
        nickname: raw[i].nickname as string,
        authorFeedbackCount: Number(raw[i].author_count),
      })),
    };
  }
}
