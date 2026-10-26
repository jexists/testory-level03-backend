import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppError, badRequest, notFound } from '../../common/app-error';
import { MSG } from '../../common/messages';
import { Feedback } from '../feedbacks/feedback.entity';
import { Recruitment } from '../recruitments/recruitment.entity';
import { RecruitmentsService } from '../recruitments/recruitments.service';
import { User } from '../users/user.entity';
import { AiAnalysis, type AnalysisResult } from './ai-analysis.entity';
import { GptClient, GptNotConfiguredError } from './gpt.client';

/** GPT 로 한 번에 보내는 피드백은 최근 100건까지 (R14) */
export const MAX_FEEDBACKS_FOR_ANALYSIS = 100;
const MAX_CONTENT_CHARS = 1000;
const TYPE_LABEL = { BUG: '버그', IMPROVEMENT: '개선 요청', PRAISE: '칭찬' } as const;

/** 분석을 시작하며 모은 피드백 */
export interface AnalysisJob {
  recruitmentId: number;
  text: string;
  feedbackCount: number;
}

/** 스트리밍 분석이 진행되며 내보내는 이벤트 */
export type AnalysisEvent =
  | { event: 'status'; data: { step: 'reading'; feedbackCount: number } | { step: 'analyzing' } | { step: 'saving' } }
  | { event: 'delta'; data: { text: string } };

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
    const job = await this.startAnalysis(recruitmentId);
    try {
      const result = await this.callGpt(recruitmentId, () => this.gpt.analyze(job.text));
      return await this.saveVersion(job, admin, result);
    } finally {
      this.inFlight.delete(recruitmentId);
    }
  }

  /**
   * 분석을 시작할 수 있는지 확인하고 모집글을 "분석 중"으로 잠근다.
   * 오류는 모두 여기서 나므로 스트리밍 응답을 열기 전에 평소처럼 JSON 오류로 돌려줄 수 있다.
   * 돌려받은 job 은 반드시 streamAnalysis 로 넘겨 잠금을 풀어야 한다.
   */
  async startAnalysis(recruitmentId: number): Promise<AnalysisJob> {
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
      return { recruitmentId, text, feedbackCount: feedbacks.length };
    } catch (e) {
      this.inFlight.delete(recruitmentId);
      throw e;
    }
  }

  /** startAnalysis 다음 단계. 진행 상황과 모델 출력 조각을 emit 으로 흘려보내고, 저장한 새 버전을 돌려준다. */
  async streamAnalysis(job: AnalysisJob, admin: User, emit: (e: AnalysisEvent) => void, signal?: AbortSignal) {
    try {
      emit({ event: 'status', data: { step: 'reading', feedbackCount: job.feedbackCount } });
      emit({ event: 'status', data: { step: 'analyzing' } });
      const result = await this.callGpt(job.recruitmentId, async () => {
        const stream = this.gpt.analyzeStream(job.text, signal);
        for (;;) {
          const next = await stream.next();
          if (next.done) return next.value;
          emit({ event: 'delta', data: { text: next.value } });
        }
      }, signal);
      emit({ event: 'status', data: { step: 'saving' } });
      return await this.saveVersion(job, admin, result);
    } finally {
      this.inFlight.delete(job.recruitmentId);
    }
  }

  private async callGpt(recruitmentId: number, run: () => Promise<AnalysisResult>, signal?: AbortSignal) {
    try {
      return await run();
    } catch (e) {
      if (e instanceof GptNotConfiguredError) {
        throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_NOT_CONFIGURED', MSG.ANALYSIS_NOT_CONFIGURED);
      }
      // 관리자가 화면을 떠나 끊긴 경우는 오류로 남기지 않는다.
      if (!signal?.aborted) {
        this.logger.error(`analysis failed (recruitment ${recruitmentId}): ${e instanceof Error ? e.message : 'unknown'}`);
      }
      throw new AppError(HttpStatus.BAD_GATEWAY, 'ANALYSIS_FAILED', MSG.ANALYSIS_FAILED);
    }
  }

  private async saveVersion(job: AnalysisJob, admin: User, result: AnalysisResult) {
    // 모집글 행을 잠그고 다음 버전 번호를 정한다. 두 관리자가 동시에 눌러도 번호가 꼬이지 않는다.
    const saved = await this.ds.transaction(async (m) => {
      await this.recruitments.lockActiveOrThrow(m, job.recruitmentId);
      const row = await m
        .getRepository(AiAnalysis)
        .createQueryBuilder('a')
        .select('COALESCE(MAX(a.versionNo), 0)', 'max')
        .where('a.recruitmentId = :id', { id: job.recruitmentId })
        .getRawOne<{ max: string }>();
      const repo = m.getRepository(AiAnalysis);
      return repo.save(
        repo.create({
          recruitmentId: job.recruitmentId,
          versionNo: Number(row?.max ?? 0) + 1,
          result,
          feedbackCount: job.feedbackCount,
          modelName: this.gpt.modelName,
          createdBy: admin.id,
        }),
      );
    });
    return this.toDetail(saved, admin.nickname);
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

  /** 관리자가 최신 분석 결과를 확인했다고 표시한다. 진행 단계가 "종료"가 된다. (분석을 다시 돌리면 "분석 완료"로 돌아간다) */
  async review(recruitmentId: number) {
    await this.recruitments.getActiveOrThrow(recruitmentId);
    if (!(await this.ds.getRepository(AiAnalysis).existsBy({ recruitmentId }))) {
      throw badRequest('ANALYSIS_REVIEW_NONE', MSG.ANALYSIS_REVIEW_NONE);
    }
    const analysisReviewedAt = new Date();
    await this.ds.getRepository(Recruitment).update({ id: recruitmentId }, { analysisReviewedAt });
    return { analysisReviewedAt };
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
