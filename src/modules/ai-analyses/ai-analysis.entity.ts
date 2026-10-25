import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Recruitment } from '../recruitments/recruitment.entity';
import { User } from '../users/user.entity';

export interface AnalysisResult {
  recurringIssues: string[];
  improvementRequests: string[];
  positiveOpinions: string[];
  priorityChecks: string[];
}

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
  result: AnalysisResult;

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
