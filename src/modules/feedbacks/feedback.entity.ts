import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FeedbackType } from '../../common/enums';
import { Recruitment } from '../recruitments/recruitment.entity';
import { User } from '../users/user.entity';

/** 피드백 수는 저장하지 않고 항상 COUNT() 로 센다. */
@Entity({ name: 'feedbacks' })
export class Feedback {
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

  @Column({ type: 'varchar', length: 12 })
  type: FeedbackType;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
