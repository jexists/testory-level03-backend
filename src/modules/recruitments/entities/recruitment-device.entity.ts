import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import type { DeviceScope, Os } from '../../../shared/types';
import { DeviceModel } from '../../users/entities/device-model.entity';
import { Recruitment } from './recruitment.entity';

@Entity('recruitment_devices')
export class RecruitmentDevice {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'recruitment_id' }) recruitmentId: number;
  @ManyToOne(() => Recruitment, (r) => r.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recruitment_id' })
  recruitment: Relation<Recruitment>;
  @Column({ type: 'varchar', length: 10 }) os: Os;
  @Column({ type: 'varchar', length: 10 }) scope: DeviceScope;
  @Column({ name: 'device_model_id', type: 'int', nullable: true }) deviceModelId: number | null;
  @ManyToOne(() => DeviceModel, { nullable: true })
  @JoinColumn({ name: 'device_model_id' })
  deviceModel: Relation<DeviceModel> | null;
  @Column({ name: 'device_capacity', type: 'int', nullable: true }) deviceCapacity: number | null;
}
