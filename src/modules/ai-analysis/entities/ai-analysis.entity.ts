import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import type { AnalysisResult } from '../../../shared/types';
import { Recruitment } from '../../recruitments/entities/recruitment.entity';

@Entity('ai_analyses')
@Index('uq_analysis_version', ['recruitmentId', 'versionNo'], { unique: true })
export class AiAnalysis {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'recruitment_id' }) recruitmentId: number;
  @ManyToOne(() => Recruitment) @JoinColumn({ name: 'recruitment_id' }) recruitment: Relation<Recruitment>;
  @Column({ name: 'version_no' }) versionNo: number;
  @Column({ type: 'jsonb' }) result: AnalysisResult;
  @Column({ name: 'feedback_count' }) feedbackCount: number;
  @Column({ name: 'model_name', length: 100 }) modelName: string;
  @Column({ name: 'created_by', type: 'int' }) createdBy: number;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}
