import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationStatus, FeedbackType } from '../../common/enums';
import { AiAnalysis } from '../ai-analyses/ai-analysis.entity';
import { Application } from '../applications/application.entity';
import { Feedback } from '../feedbacks/feedback.entity';
import { CLOSING_SOON_DAYS, computeStage, STAGES, type Stage } from '../recruitments/recruitment-rules';
import { Recruitment } from '../recruitments/recruitment.entity';

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * 삭제되지 않은 모집글만 센다. (R11) 모든 숫자는 저장해 둔 값이 아니라 그때그때 COUNT 한 값이다.
   * 모집글마다 진행 단계를 계산해, 관리자가 지금 무엇을 확인해야 하는지 보여 준다.
   */
  async summary() {
    const qb = this.ds.getRepository(Recruitment).createQueryBuilder('r').where('r.deletedAt IS NULL');
    const partSub = qb.subQuery().select('COUNT(*)').from(Application, 'a').where(`a.recruitmentId = r.id AND a.status = '${ApplicationStatus.APPLIED}'`).getQuery();
    const fbSub = qb.subQuery().select('COUNT(*)').from(Feedback, 'f').where('f.recruitmentId = r.id').getQuery();
    const bugSub = qb.subQuery().select('COUNT(*)').from(Feedback, 'fb').where(`fb.recruitmentId = r.id AND fb.type = '${FeedbackType.BUG}'`).getQuery();
    const latestSub = qb.subQuery().select('MAX(an.versionNo)').from(AiAnalysis, 'an').where('an.recruitmentId = r.id').getQuery();
    const latestAtSub = qb.subQuery().select('MAX(an2.createdAt)').from(AiAnalysis, 'an2').where('an2.recruitmentId = r.id').getQuery();
    const { entities, raw } = await qb
      .addSelect(`(${partSub})::int`, 'participants')
      .addSelect(`(${fbSub})::int`, 'feedback_count')
      .addSelect(`(${bugSub})::int`, 'bug_count')
      .addSelect(`(${latestSub})`, 'latest_version')
      .addSelect(`(${latestAtSub})`, 'latest_analysis_at')
      .orderBy('r.createdAt', 'DESC')
      .getRawAndEntities();

    const now = new Date();
    const soon = now.getTime() + CLOSING_SOON_DAYS * 86_400_000;
    const recruitments = entities.map((r, i) => {
      const participants = Number(raw[i].participants);
      const latestAnalysisAt = raw[i].latest_analysis_at ? new Date(raw[i].latest_analysis_at) : null;
      return {
        id: r.id,
        title: r.title,
        stage: computeStage({ ...r, participants, latestAnalysisAt }, now),
        participants,
        capacity: r.capacity,
        feedbackCount: Number(raw[i].feedback_count),
        bugCount: Number(raw[i].bug_count),
        startAt: r.startAt,
        endAt: r.endAt,
        feedbackDueAt: r.feedbackDueAt,
        testStartedAt: r.testStartedAt,
        latestAnalysisVersion: raw[i].latest_version == null ? null : Number(raw[i].latest_version),
      };
    });

    const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    for (const r of recruitments) stageCounts[r.stage] += 1;

    return {
      counts: {
        recruiting: stageCounts.RECRUITING,
        closingSoon: recruitments.filter((r) => r.stage === 'RECRUITING' && r.startAt.getTime() <= soon).length,
        // 새 규칙에서는 정원이 차면 바로 테스트가 시작되므로 "모집 중인데 정원이 찬 글" 대신 이 수를 보여 준다.
        filledEarly: recruitments.filter((r) => r.stage === 'TESTING' && r.testStartedAt).length,
      },
      stageCounts,
      recruitments,
    };
  }
}
