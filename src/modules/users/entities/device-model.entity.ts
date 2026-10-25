import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Os } from '../../../shared/types';

@Entity('device_models')
export class DeviceModel {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 10 }) os: Os;
  @Column({ name: 'model_name', length: 100 }) modelName: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
}
