import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MSG } from '../../shared/constants/messages';
import { Application } from '../applications/entities/application.entity';
import { Recruitment } from '../recruitments/entities/recruitment.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Feedback } from './entities/feedback.entity';

@Injectable()
export class FeedbacksService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  /** R9·R11 */
  async write(recruitmentId: number, userId: number, dto: CreateFeedbackDto) {
    if (!dto.title.trim() || !dto.content.trim()) throw new BadRequestException('제목과 내용을 모두 입력해 주세요.');
    const rec = await this.ds.getRepository(Recruitment).findOne({ where: { id: recruitmentId } });
    if (!rec || rec.deletedAt) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
    const joined = await this.ds.getRepository(Application).findOne({ where: { recruitmentId, userId, status: 'APPLIED' } });
    if (!joined) throw new ForbiddenException('참여 중인 모집글에만 쓸 수 있어요.');
    return this.ds.getRepository(Feedback).save({
      recruitmentId, userId, type: dto.type, title: dto.title.trim().slice(0, 200), content: dto.content.trim(),
    });
  }

  async mine(userId: number) {
    const rows = await this.ds.getRepository(Feedback).createQueryBuilder('f')
      .innerJoinAndSelect('f.recruitment', 'r').where('f.user_id = :userId and r.deleted_at is null', { userId })
      .orderBy('f.id', 'DESC').getMany();
    return rows.map((f) => ({
      id: f.id, type: f.type, title: f.title, content: f.content, createdAt: f.createdAt,
      recruitment: { id: f.recruitment.id, title: f.recruitment.title },
    }));
  }

  /** A5: 전체 피드백. authorCount 는 작성자가 (필터된 범위 안에서) 쓴 피드백 수. */
  async listAll(q: { type?: string; recruitmentId?: string; sort?: string }) {
    const params: any[] = [];
    let where = 'r.deleted_at is null';
    if (['BUG', 'IMPROVEMENT', 'PRAISE'].includes(q.type ?? '')) { params.push(q.type); where += ` and f.type = $${params.length}`; }
    const rid = Number(q.recruitmentId);
    if (q.recruitmentId && Number.isInteger(rid)) { params.push(rid); where += ` and f.recruitment_id = $${params.length}`; }
    const order = q.sort === 'author' ? 'author_count desc, f.id desc' : 'f.id desc';
    const rows = await this.ds.query(
      `select f.id, f.type, f.title, f.content, f.created_at as "createdAt", u.nickname as author, f.user_id as "userId",
              r.id as "recruitmentId", r.title as "recruitmentTitle",
              count(*) over (partition by f.user_id) as author_count
         from feedbacks f join recruitments r on r.id = f.recruitment_id join users u on u.id = f.user_id
        where ${where} order by ${order}`,
      params,
    );
    return rows.map((r: any) => ({ ...r, authorCount: Number(r.author_count), author_count: undefined }));
  }
}
