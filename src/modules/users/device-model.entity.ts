import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Os } from '../../common/enums';

@Entity({ name: 'device_models' })
export class DeviceModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  os: Os;

  @Column({ name: 'model_name', type: 'varchar', length: 60 })
  modelName: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
