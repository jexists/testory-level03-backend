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

  /** OS 를 목록에서 고르지 않고 직접 입력했을 때의 이름 ("기타") */
  @Column({ name: 'device_os_name', type: 'varchar', length: 30, nullable: true })
  deviceOsName: string | null;

  /** 모델을 목록에서 고르지 않고 직접 입력했을 때의 이름 ("기타") */
  @Column({ name: 'device_model_name', type: 'varchar', length: 60, nullable: true })
  deviceModelName: string | null;

  @ManyToOne(() => DeviceModel, { nullable: true })
  @JoinColumn({ name: 'device_model_id' })
  deviceModel?: DeviceModel | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
