import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn,
} from 'typeorm';
import type { Os, Role } from '../../../shared/types';
import { DeviceModel } from './device-model.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column({ length: 255 }) email: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column({ length: 50 }) nickname: string;
  @Column({ type: 'varchar', length: 10, default: 'USER' }) role: Role;
  @Column({ name: 'device_type', type: 'varchar', length: 10, nullable: true }) deviceType: Os | null;
  @Column({ name: 'device_model_id', type: 'int', nullable: true }) deviceModelId: number | null;
  @ManyToOne(() => DeviceModel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'device_model_id' })
  deviceModel: Relation<DeviceModel> | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
