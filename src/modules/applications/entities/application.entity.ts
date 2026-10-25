import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import type { ApplicationStatus, Os } from '../../../shared/types';
import { Recruitment } from '../../recruitments/entities/recruitment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('applications')
@Index('uq_active_application', ['recruitmentId', 'userId'], { unique: true, where: `"status" = 'APPLIED'` })
export class Application {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'recruitment_id' }) recruitmentId: number;
  @ManyToOne(() => Recruitment) @JoinColumn({ name: 'recruitment_id' }) recruitment: Relation<Recruitment>;
  @Column({ name: 'user_id' }) userId: number;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: Relation<User>;
  /** 신청 당시 기기(R6) — 내 정보에서 복사해 둔 값 */
  @Column({ name: 'device_type', type: 'varchar', length: 10 }) deviceType: Os;
  @Column({ name: 'device_model', length: 100 }) deviceModel: string;
  @Column({ type: 'varchar', length: 10, default: 'APPLIED' }) status: ApplicationStatus;
  @Column({ name: 'applied_at', type: 'timestamptz', default: () => 'now()' }) appliedAt: Date;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
}
