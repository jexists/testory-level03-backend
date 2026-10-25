import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppError, badRequest, notFound } from '../../common/app-error';
import { MSG } from '../../common/messages';
import { Feedback } from '../feedbacks/feedback.entity';
import { Recruitment } from '../recruitments/recruitment.entity';
import { RecruitmentsService } from '../recruitments/recruitments.service';
import { User } from '../users/user.entity';
import { AiAnalysis } from './ai-analysis.entity';
import { GptClient, GptNotConfiguredError } from './gpt.client';

/** GPT 로 한 번에 보내는 피드백은 최근 100건까지 (R14) */
export const MAX_FEEDBACKS_FOR_ANALYSIS = 100;
const MAX_CONTENT_CHARS = 1000;
const TYPE_LABEL = { BUG: '버그', IMPROVEMENT: '개선 요청', PRAISE: '칭찬' } as const;

@Injectable()
export class AiAnalysesService {
  private readonly logger = new Logger(AiAnalysesService.name);
  /** 분석 중인 모집글. 같은 모집글을 두 번 눌러도 GPT 를 중복 호출하지 않는다. (서버 1대 기준) */
  private readonly inFlight = new Set<number>();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly recruitments: RecruitmentsService,
    private readonly gpt: GptClient,
  ) {}

  /**
   * R13/R14: 피드백이 1건 이상일 때만 분석한다. 성공했을 때만 새 버전을 저장하고,
   * 실패하면 아무것도 저장하지 않는다. 이전 버전은 건드리지 않는다.
   */
  async analyze(recruitmentId: number, admin: User) {
    await this.recruitments.getActiveOrThrow(recruitmentId);

    const total = await this.ds.getRepository(Feedback).countBy({ recruitmentId });
    if (total === 0) throw badRequest('NO_FEEDBACK', MSG.ANALYSIS_NO_FEEDBACK); // GPT 를 부르지 않는다
    if (!this.gpt.isConfigured) {
      throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_NOT_CONFIGURED', MSG.ANALYSIS_NOT_CONFIGURED);
    }
    if (this.inFlight.has(recruitmentId)) {
      throw new AppError(HttpStatus.CONFLICT, 'ANALYSIS_IN_PROGRESS', MSG.ANALYSIS_IN_PROGRESS);
    }

    this.inFlight.add(recruitmentId);
    try {
      const feedbacks = await this.ds
        .getRepository(Feedback)
        .find({ where: { recruitmentId }, order: { createdAt: 'DESC', id: 'DESC' }, take: MAX_FEEDBACKS_FOR_ANALYSIS });
      const text = feedbacks
        .map((f, i) => `#${i + 1} [${TYPE_LABEL[f.type]}] ${f.title}\n${f.content.slice(0, MAX_CONTENT_CHARS)}`)
        .join('\n\n');

      let result;
      try {
        result = await this.gpt.analyze(text);
      } catch (e) {
        if (e instanceof GptNotConfiguredError) {
          throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_NOT_CONFIGURED', MSG.ANALYSIS_NOT_CONFIGURED);
        }
        this.logger.error(`analysis failed (recruitment ${recruitmentId}): ${e instanceof Error ? e.message : 'unknown'}`);
        throw new AppError(HttpStatus.BAD_GATEWAY, 'ANALYSIS_FAILED', MSG.ANALYSIS_FAILED);
      }

      // 모집글 행을 잠그고 다음 버전 번호를 정한다. 두 관리자가 동시에 눌러도 번호가 꼬이지 않는다.
      const saved = await this.ds.transaction(async (m) => {
        await this.recruitments.lockActiveOrThrow(m, recruitmentId);
        const row = await m
          .getRepository(AiAnalysis)
          .createQueryBuilder('a')
          .select('COALESCE(MAX(a.versionNo), 0)', 'max')
          .where('a.recruitmentId = :id', { id: recruitmentId })
          .getRawOne<{ max: string }>();
        const repo = m.getRepository(AiAnalysis);
        return repo.save(
          repo.create({
            recruitmentId,
            versionNo: Number(row?.max ?? 0) + 1,
            result,
            feedbackCount: feedbacks.length,
            modelName: this.gpt.modelName,
            createdBy: admin.id,
          }),
        );
      });
      return this.toDetail(saved, admin.nickname);
    } finally {
      this.inFlight.delete(recruitmentId);
    }
  }

  private async assertRecruitmentExists(id: number) {
    // 관리자는 삭제된 글의 저장된 분석도 볼 수 있다.
    if (!(await this.ds.getRepository(Recruitment).existsBy({ id }))) {
      throw notFound('RECRUITMENT_NOT_FOUND', MSG.RECRUITMENT_NOT_FOUND);
    }
  }

  async listVersions(recruitmentId: number) {
    await this.assertRecruitmentExists(recruitmentId);
    const rows = await this.ds
      .getRepository(AiAnalysis)
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.creator', 'u')
      .where('a.recruitmentId = :id', { id: recruitmentId })
      .orderBy('a.versionNo', 'DESC')
      .getMany();
    return rows.map((a) => ({
      versionNo: a.versionNo,
      createdAt: a.createdAt,
      feedbackCount: a.feedbackCount,
      modelName: a.modelName,
      createdByNickname: a.creator?.nickname ?? null,
    }));
  }

  async getVersion(recruitmentId: number, version: 'latest' | number) {
    await this.assertRecruitmentExists(recruitmentId);
    const qb = this.ds
      .getRepository(AiAnalysis)
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.creator', 'u')
      .where('a.recruitmentId = :id', { id: recruitmentId });
    if (version === 'latest') qb.orderBy('a.versionNo', 'DESC').limit(1);
    else qb.andWhere('a.versionNo = :v', { v: version });
    const row = await qb.getOne();
    if (!row) throw notFound('ANALYSIS_NOT_FOUND', MSG.ANALYSIS_NOT_FOUND);
    return this.toDetail(row, row.creator?.nickname ?? null);
  }

  private toDetail(a: AiAnalysis, creatorNickname: string | null) {
    return {
      versionNo: a.versionNo,
      createdAt: a.createdAt,
      feedbackCount: a.feedbackCount,
      modelName: a.modelName,
      createdByNickname: creatorNickname,
      result: a.result,
    };
  }
}
