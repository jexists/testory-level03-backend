import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import type { FeedbackType } from '../../../shared/types';
import { Recruitment } from '../../recruitments/entities/recruitment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'recruitment_id' }) recruitmentId: number;
  @ManyToOne(() => Recruitment) @JoinColumn({ name: 'recruitment_id' }) recruitment: Relation<Recruitment>;
  @Column({ name: 'user_id' }) userId: number;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: Relation<User>;
  @Column({ type: 'varchar', length: 12 }) type: FeedbackType;
  @Column({ length: 200 }) title: string;
  @Column({ type: 'text' }) content: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}
