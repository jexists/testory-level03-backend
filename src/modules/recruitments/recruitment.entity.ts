import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RecruitmentKind } from '../../common/enums';
import { RecruitmentDevice } from './recruitment-device.entity';

@Entity({ name: 'recruitments' })
export class Recruitment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 12 })
  kind: RecruitmentKind;

  @Column({ type: 'int', default: 15 })
  capacity: number;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  /** 이 시각 전까지만 피드백을 쓸 수 있다. 기본값은 종료일 + 3일 */
  @Column({ name: 'feedback_due_at', type: 'timestamptz' })
  feedbackDueAt: Date;

  /** 정원이 차서 테스트가 일찍 시작된 시각. 시작일에 시작했다면 비어 있다. */
  @Column({ name: 'test_started_at', type: 'timestamptz', nullable: true })
  testStartedAt: Date | null;

  /** 관리자가 AI 분석 결과를 "확인 완료"한 시각 */
  @Column({ name: 'analysis_reviewed_at', type: 'timestamptz', nullable: true })
  analysisReviewedAt: Date | null;

  @Column({ name: 'is_closed', type: 'boolean', default: false })
  isClosed: boolean;

  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_ip', type: 'varchar', length: 64, nullable: true })
  createdIp: string | null;

  @Column({ name: 'updated_ip', type: 'varchar', length: 64, nullable: true })
  updatedIp: string | null;

  /** 비어 있으면 삭제되지 않은 글 (Soft Delete) */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'deleted_ip', type: 'varchar', length: 64, nullable: true })
  deletedIp: string | null;

  @OneToMany(() => RecruitmentDevice, (d) => d.recruitment)
  devices?: RecruitmentDevice[];
}
