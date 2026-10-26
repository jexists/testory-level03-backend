import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { AppError, badRequest, notFound } from '../../common/app-error';
import { MSG } from '../../common/messages';
import { Application } from '../applications/application.entity';
import { Feedback } from '../feedbacks/feedback.entity';
import { Recruitment } from '../recruitments/recruitment.entity';
import { RecruitmentsService } from '../recruitments/recruitments.service';
import { User } from '../users/user.entity';
import { AiAnalysis, type AnalysisResult } from './ai-analysis.entity';
import {
  applyJudgements,
  attachReferences,
  citedFeedbackIds,
  judgeTargets,
  normalizeResult,
  searchTargets,
  verifySummary,
  type SourceFeedback,
} from './analysis-verify';
import { GptClient, GptNotConfiguredError } from './gpt.client';

/** GPT 로 한 번에 보내는 피드백은 최근 100건까지 (R14) */
export const MAX_FEEDBACKS_FOR_ANALYSIS = 100;
const MAX_CONTENT_CHARS = 1000;
/** 판단 단계에 근거로 보여 줄 피드백 원문 길이 */
const MAX_JUDGE_CONTENT_CHARS = 400;
/** 웹 검색은 이만큼의 항목 묶음까지만 (시간·비용 제한) */
const MAX_SEARCH_TARGETS = 6;
const TYPE_LABEL = { BUG: '버그', IMPROVEMENT: '개선 요청', PRAISE: '칭찬' } as const;
const OS_LABEL: Record<string, string> = { ANDROID: 'Android', IOS: 'iOS' };

/** 분석·화면에 쓰는 피드백 한 건 (작성자 닉네임과 신청 당시 기기 포함) */
export interface FeedbackContext extends SourceFeedback {
  type: Feedback['type'];
  createdAt: Date;
  nickname: string | null;
  deviceType: string | null;
  deviceModel: string | null;
}

/** 분석을 시작하며 모은 피드백 */
export interface AnalysisJob {
  recruitmentId: number;
  appTitle: string;
  text: string;
  feedbackCount: number;
  feedbacks: Map<number, FeedbackContext>;
}

type Step = 'reading' | 'summarizing' | 'searching' | 'judging' | 'saving';

/** 분석이 진행되며 내보내는 이벤트 */
export type AnalysisEvent =
  | { event: 'status'; data: { step: Step; feedbackCount?: number; total?: number } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'reference'; data: { done: number; total: number; found: number; query: string; hosts: string[] } };

const deviceLabel = (f: Pick<FeedbackContext, 'deviceType' | 'deviceModel'>) =>
  f.deviceType ? [OS_LABEL[f.deviceType] ?? f.deviceType, f.deviceModel].filter(Boolean).join(' · ') : '알 수 없음';

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
    return this.streamAnalysis(job, admin, () => undefined);
  }

  /**
   * 분석을 시작할 수 있는지 확인하고 모집글을 "분석 중"으로 잠근다.
   * 오류는 모두 여기서 나므로 스트리밍 응답을 열기 전에 평소처럼 JSON 오류로 돌려줄 수 있다.
   * 돌려받은 job 은 반드시 streamAnalysis 로 넘겨 잠금을 풀어야 한다.
   */
  async startAnalysis(recruitmentId: number): Promise<AnalysisJob> {
    const recruitment = await this.recruitments.getActiveOrThrow(recruitmentId);

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
      const list = await this.loadFeedbacks(recruitmentId, { take: MAX_FEEDBACKS_FOR_ANALYSIS });
      // 실제 피드백 ID 를 [F번호] 로 넘겨 모델이 근거를 ID 로 가리키게 한다. 닉네임은 보내지 않는다.
      const text = list
        .map((f) => `[F${f.id}] 유형: ${TYPE_LABEL[f.type]} | 기기: ${deviceLabel(f)}\n제목: ${f.title}\n내용: ${f.content.slice(0, MAX_CONTENT_CHARS)}`)
        .join('\n\n');
      return { recruitmentId, appTitle: recruitment.title, text, feedbackCount: list.length, feedbacks: new Map(list.map((f) => [f.id, f])) };
    } catch (e) {
      this.inFlight.delete(recruitmentId);
      throw e;
    }
  }

  /**
   * startAnalysis 다음 단계. 요약(피드백만) → 웹 참고자료 검색 → 조치 판단 순서로 진행하며
   * 진행 상황과 요약 출력 조각을 emit 으로 흘려보내고, 저장한 새 버전을 돌려준다.
   * 요약·판단이 실패하면 저장하지 않는다. 검색은 항목별로 실패해도 그 항목만 참고자료 없이 둔다.
   */
  async streamAnalysis(job: AnalysisJob, admin: User, emit: (e: AnalysisEvent) => void, signal?: AbortSignal) {
    try {
      emit({ event: 'status', data: { step: 'reading', feedbackCount: job.feedbackCount } });
      emit({ event: 'status', data: { step: 'summarizing' } });
      const raw = await this.callGpt(job.recruitmentId, async () => {
        const stream = this.gpt.summarizeStream(job.text, signal);
        for (;;) {
          const next = await stream.next();
          if (next.done) return next.value;
          emit({ event: 'delta', data: { text: next.value } });
        }
      }, signal);
      const result = verifySummary(raw, job.feedbacks);

      const targets = searchTargets(result, MAX_SEARCH_TARGETS);
      emit({ event: 'status', data: { step: 'searching', total: targets.length } });
      let done = 0;
      let found = 0;
      const refs = await Promise.all(
        targets.map(async (t) => {
          const r = await this.gpt.searchReferences({ summary: t.query, type: t.type, appTitle: job.appTitle }, signal).catch((e: unknown) => {
            if (!signal?.aborted) this.logger.warn(`reference search failed (recruitment ${job.recruitmentId}): ${e instanceof Error ? e.message : 'unknown'}`);
            return [];
          });
          done++;
          found += r.length;
          // 화면에 "무엇을 검색해 어느 사이트를 찾았는지" 보여 주도록 검색 문장과 확인된 자료의 도메인을 함께 보낸다.
          const hosts = [...new Set(r.map((x) => new URL(x.url).hostname.replace(/^www\./, '')))];
          emit({ event: 'reference', data: { done, total: targets.length, found, query: t.query, hosts } });
          return r;
        }),
      );
      if (signal?.aborted) throw new Error('aborted');
      attachReferences(targets, refs);

      const judged = judgeTargets(result);
      if (judged.length > 0) {
        emit({ event: 'status', data: { step: 'judging' } });
        const judgements = await this.callGpt(job.recruitmentId, () => this.gpt.judge(this.judgeInput(judged, job.feedbacks), signal), signal);
        applyJudgements(result, judgements);
      }

      emit({ event: 'status', data: { step: 'saving' } });
      return await this.saveVersion(job, admin, result);
    } finally {
      this.inFlight.delete(job.recruitmentId);
    }
  }

  /** 판단 단계 입력. 항목 요약, 근거 피드백 원문, 확인된 참고자료를 함께 넘긴다. */
  private judgeInput(targets: ReturnType<typeof judgeTargets>, feedbacks: Map<number, FeedbackContext>) {
    return targets
      .map(({ key, item }) => {
        const quotes = item.feedbackIds
          .map((id) => feedbacks.get(id))
          .filter((f): f is FeedbackContext => !!f)
          .map((f) => `  - [F${f.id}] (${TYPE_LABEL[f.type]}, ${deviceLabel(f)}) ${f.title}: ${f.content.slice(0, MAX_JUDGE_CONTENT_CHARS)}`);
        const refs = item.references.map((r) => `  - [${r.id}] ${r.title}: ${r.citedText}`);
        return [
          `key: ${key}`,
          `유형: ${item.type ?? 'other'}`,
          `요약: ${item.summary}`,
          '근거 피드백:',
          ...quotes,
          '참고자료:',
          ...(refs.length ? refs : ['  (확인된 참고자료 없음)']),
        ].join('\n');
      })
      .join('\n\n');
  }

  /** 피드백을 작성자 닉네임, 신청 당시 기기와 함께 불러온다. (최신순) */
  private async loadFeedbacks(recruitmentId: number, opts: { take?: number; ids?: number[] }): Promise<FeedbackContext[]> {
    if (opts.ids?.length === 0) return [];
    const rows = await this.ds.getRepository(Feedback).find({
      where: { recruitmentId, ...(opts.ids ? { id: In(opts.ids) } : {}) },
      relations: { user: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: opts.take,
    });
    const userIds = [...new Set(rows.map((f) => f.userId))];
    const apps = userIds.length
      ? await this.ds.getRepository(Application).find({ where: { recruitmentId, userId: In(userIds) }, order: { appliedAt: 'DESC' } })
      : [];
    // 다시 신청한 경우도 있어 가장 최근 신청의 기기를 쓴다.
    const device = new Map<number, Application>();
    for (const a of apps) if (!device.has(a.userId)) device.set(a.userId, a);
    return rows.map((f) => ({
      id: f.id,
      type: f.type,
      title: f.title,
      content: f.content,
      createdAt: f.createdAt,
      nickname: f.user?.nickname ?? null,
      deviceType: device.get(f.userId)?.deviceType ?? null,
      deviceModel: device.get(f.userId)?.deviceModel ?? null,
    }));
  }

  private async callGpt<T>(recruitmentId: number, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
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

  /** 저장된 결과를 지금 모양으로 맞추고, 근거 피드백의 원문·작성자·기기를 붙여 돌려준다. (저장은 ID 만 한다) */
  private async toDetail(a: AiAnalysis, creatorNickname: string | null) {
    const result = normalizeResult(a.result);
    const list = await this.loadFeedbacks(a.recruitmentId, { ids: citedFeedbackIds(result) });
    return {
      versionNo: a.versionNo,
      createdAt: a.createdAt,
      feedbackCount: a.feedbackCount,
      modelName: a.modelName,
      createdByNickname: creatorNickname,
      result,
      feedbacks: Object.fromEntries(list.map((f) => [f.id, f])),
    };
  }
}
