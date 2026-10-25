import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ApplicationStatus, Os } from '../../common/enums';
import { Recruitment } from '../recruitments/recruitment.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'applications' })
export class Application {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'recruitment_id', type: 'int' })
  recruitmentId: number;

  @ManyToOne(() => Recruitment)
  @JoinColumn({ name: 'recruitment_id' })
  recruitment?: Recruitment;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** 신청 당시 기기 OS (복사본) */
  @Column({ name: 'device_type', type: 'varchar', length: 10 })
  deviceType: Os;

  /** 신청 당시 기기 모델 이름 (복사본) */
  @Column({ name: 'device_model', type: 'varchar', length: 60 })
  deviceModel: string;

  @Column({ type: 'varchar', length: 10, default: ApplicationStatus.APPLIED })
  status: ApplicationStatus;

  @Column({ name: 'applied_at', type: 'timestamptz', default: () => 'now()' })
  appliedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}
