import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Recruitment } from '../recruitments/recruitment.entity';
import { User } from '../users/user.entity';

/** 분석 항목의 성격. 버그 "의심"일 뿐 확인된 버그는 아니다. */
export type AnalysisItemType = 'bugSuspected' | 'featureRequest' | 'usability' | 'positive' | 'other';
export type Confidence = 'high' | 'medium' | 'low';
export type AiSuitability = 'recommended' | 'optional' | 'unnecessary' | 'insufficientInformation';

/** 웹 검색으로 찾고 서버가 직접 열어 본 참고자료. 검색 결과에 실제로 있던 URL 만 남긴다. */
export interface AnalysisReference {
  /** 분석 한 버전 안에서 겹치지 않는 ID (R1, R2, …) */
  id: string;
  url: string;
  title: string;
  /** 모델이 이 링크를 근거로 쓴 문장 */
  citedText: string;
  /** 검색에 쓴 문장 (항목 요약) */
  query: string;
  /** 서버가 URL 을 열어 응답을 확인한 시각 */
  checkedAt: string;
}

/** AI 의 판단. 사용자 의견이 아니고 확정된 해결책도 아니다. */
export interface AnalysisAction {
  recommendedAction: string;
  rationale: string;
  confidence: Confidence;
  aiSuitability: AiSuitability;
  aiReason: string;
  referenceIds: string[];
}

export interface AnalysisItem {
  summary: string;
  type: AnalysisItemType | null;
  /** 근거 피드백 ID. 입력에 실제 있던 것만 남긴다. */
  feedbackIds: number[];
  /** 근거 피드백 수. 모델 값이 아니라 서버가 feedbackIds 로 센다. */
  mentionCount: number;
  /** 근거 피드백 원문에 그대로 있는 문장만 */
  evidence: string[];
  references: AnalysisReference[];
  action: AnalysisAction | null;
}

export const ANALYSIS_SECTION_KEYS = ['recurringIssues', 'improvementRequests', 'positiveOpinions', 'priorityChecks'] as const;
export type AnalysisSectionKey = (typeof ANALYSIS_SECTION_KEYS)[number];

export type AnalysisResult = {
  /** 1: 예전 문자열 목록 버전(조회할 때 이 모양으로 바꿔 준다), 2: 근거·참고자료·판단 포함 */
  schemaVersion: 1 | 2;
  overview: string;
} & Record<AnalysisSectionKey, AnalysisItem[]>;

/** 예전 버전(v1)이 DB 에 저장된 모양 */
export type LegacyAnalysisResult = Record<AnalysisSectionKey, string[]>;

/** 한 번 저장한 버전은 고치거나 지우지 않는다. */
@Entity({ name: 'ai_analyses' })
export class AiAnalysis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'recruitment_id', type: 'int' })
  recruitmentId: number;

  @ManyToOne(() => Recruitment)
  @JoinColumn({ name: 'recruitment_id' })
  recruitment?: Recruitment;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  @Column({ type: 'jsonb' })
  result: AnalysisResult | LegacyAnalysisResult;

  /** 분석에 실제로 사용한 피드백 건수 (최대 100) */
  @Column({ name: 'feedback_count', type: 'int' })
  feedbackCount: number;

  @Column({ name: 'model_name', type: 'varchar', length: 60 })
  modelName: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
