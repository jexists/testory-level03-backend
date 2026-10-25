import {
  BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { DataSource } from 'typeorm';
import { MSG } from '../../shared/constants/messages';
import type { AnalysisResult } from '../../shared/types';
import { Feedback } from '../feedbacks/entities/feedback.entity';
import { Recruitment } from '../recruitments/entities/recruitment.entity';
import { AiAnalysis } from './entities/ai-analysis.entity';

const TYPE_KO = { BUG: '버그', IMPROVEMENT: '개선 요청', PRAISE: '칭찬' } as const;
const FAIL = 'AI 분석에 실패했어요. 잠시 뒤 다시 시도해 주세요.';
const LOCK_NS = 7001;

const SYSTEM = `너는 앱 베타테스트 피드백을 정리하는 분석가야. 한 모집글에 달린 피드백 전체를 읽고 한국어로 종합해.
반드시 아래 JSON 형식만 출력해. 각 항목은 짧은 문장의 배열(최대 5개)이야. 근거 없는 내용은 만들지 마.
{"recurringIssues": ["반복되는 문제"], "improvementRequests": ["개선 요청"], "positiveOpinions": ["긍정 의견"], "priorities": ["먼저 확인할 것(우선순위 높은 순)"]}`;

const view = (a: AiAnalysis) => ({
  id: a.id, recruitmentId: a.recruitmentId, versionNo: a.versionNo, result: a.result,
  feedbackCount: a.feedbackCount, modelName: a.modelName, createdAt: a.createdAt,
});

@Injectable()
export class AiAnalysisService {
  private log = new Logger('AI');
  constructor(@InjectDataSource() private ds: DataSource, private cfg: ConfigService) {}

  private async recruitment(id: number) {
    const r = await this.ds.getRepository(Recruitment).findOne({ where: { id } });
    if (!r) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);
    return r;
  }

  private parse(text: string): AnalysisResult {
    const j = JSON.parse(text);
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : null);
    const out = {
      recurringIssues: arr(j.recurringIssues), improvementRequests: arr(j.improvementRequests),
      positiveOpinions: arr(j.positiveOpinions), priorities: arr(j.priorities),
    };
    if (Object.values(out).some((v) => v === null)) throw new Error('GPT 응답 형식이 올바르지 않아요');
    return out as AnalysisResult;
  }

  /** R13·R14 */
  async run(recruitmentId: number, adminId: number) {
    const rec = await this.recruitment(recruitmentId);
    if (rec.deletedAt) throw new NotFoundException(MSG.RECRUITMENT_NOT_FOUND);

    const total = await this.ds.getRepository(Feedback).count({ where: { recruitmentId } });
    if (total < 1) throw new BadRequestException('분석할 피드백이 아직 없어요.'); // GPT 호출 전에 거절

    const key = this.cfg.get<string>('gpt.apiKey');
    if (!key) {
      this.log.warn('GPT_API_KEY 가 비어 있어 분석을 건너뜁니다.');
      throw new HttpException('GPT API 키가 설정되지 않았어요. 서버 설정(.env)을 확인해 주세요.', 503);
    }

    // 같은 모집글의 중복 호출 방지 + 버전 번호 직렬화: 연결 하나에서 advisory lock 을 잡고 끝까지 쓴다.
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    let locked = false;
    try {
      const [{ ok }] = await qr.query('select pg_try_advisory_lock($1, $2) as ok', [LOCK_NS, recruitmentId]);
      if (!ok) throw new ConflictException('이미 분석 중이에요. 잠시 뒤에 결과를 확인해 주세요.');
      locked = true;

      const fbs: Feedback[] = await qr.manager.getRepository(Feedback).find({
        where: { recruitmentId }, order: { id: 'DESC' }, take: 100,
      });
      fbs.reverse();
      const model = this.cfg.getOrThrow<string>('gpt.model');
      let result: AnalysisResult;
      try {
        const ai = new OpenAI({ apiKey: key, timeout: 60_000, maxRetries: 1 });
        const prompt = `모집글: ${rec.title}\n피드백 ${fbs.length}건:\n` +
          fbs.map((f, i) => `${i + 1}. [${TYPE_KO[f.type]}] ${f.title} — ${f.content}`).join('\n');
        const res = await ai.chat.completions.create({
          model, response_format: { type: 'json_object' }, temperature: 0.3,
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        });
        result = this.parse(res.choices[0]?.message?.content ?? '');
      } catch (e) {
        this.log.error(`GPT 호출 실패: ${(e as Error).message}`);
        throw new HttpException(FAIL, 502); // 실패하면 아무것도 저장하지 않는다.
      }

      const [{ next }] = await qr.query('select coalesce(max(version_no), 0) + 1 as next from ai_analyses where recruitment_id = $1', [recruitmentId]);
      const saved = await qr.manager.getRepository(AiAnalysis).save({
        recruitmentId, versionNo: Number(next), result, feedbackCount: total, modelName: model, createdBy: adminId,
      });
      return view(saved);
    } finally {
      if (locked) await qr.query('select pg_advisory_unlock($1, $2)', [LOCK_NS, recruitmentId]).catch(() => undefined);
      await qr.release();
    }
  }

  async versions(recruitmentId: number) {
    await this.recruitment(recruitmentId);
    const rows = await this.ds.getRepository(AiAnalysis).find({ where: { recruitmentId }, order: { versionNo: 'DESC' } });
    return rows.map((a) => ({ versionNo: a.versionNo, feedbackCount: a.feedbackCount, createdAt: a.createdAt, modelName: a.modelName }));
  }

  async one(recruitmentId: number, version: string) {
    await this.recruitment(recruitmentId);
    const repo = this.ds.getRepository(AiAnalysis);
    const a = version === 'latest'
      ? await repo.findOne({ where: { recruitmentId }, order: { versionNo: 'DESC' } })
      : await repo.findOne({ where: { recruitmentId, versionNo: Number(version) || -1 } });
    if (!a) throw new NotFoundException('저장된 분석이 아직 없어요.');
    return view(a);
  }
}
