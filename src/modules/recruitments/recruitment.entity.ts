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
