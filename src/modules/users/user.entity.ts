import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Os, Role } from '../../common/enums';
import { DeviceModel } from './device-model.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 30 })
  nickname: string;

  @Column({ type: 'varchar', length: 10, default: Role.USER })
  role: Role;

  @Column({ name: 'device_type', type: 'varchar', length: 10, nullable: true })
  deviceType: Os | null;

  @Column({ name: 'device_model_id', type: 'int', nullable: true })
  deviceModelId: number | null;

  @ManyToOne(() => DeviceModel, { nullable: true })
  @JoinColumn({ name: 'device_model_id' })
  deviceModel?: DeviceModel | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
