import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DeviceScope, Os } from '../../common/enums';
import { DeviceModel } from '../users/device-model.entity';
import { Recruitment } from './recruitment.entity';

@Entity({ name: 'recruitment_devices' })
export class RecruitmentDevice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'recruitment_id', type: 'int' })
  recruitmentId: number;

  @ManyToOne(() => Recruitment, (r) => r.devices)
  @JoinColumn({ name: 'recruitment_id' })
  recruitment?: Recruitment;

  @Column({ type: 'varchar', length: 10 })
  os: Os;

  @Column({ type: 'varchar', length: 10 })
  scope: DeviceScope;

  @Column({ name: 'device_model_id', type: 'int', nullable: true })
  deviceModelId: number | null;

  @ManyToOne(() => DeviceModel, { nullable: true })
  @JoinColumn({ name: 'device_model_id' })
  deviceModel?: DeviceModel | null;

  /** 목록에 없는 모델을 "기타"로 직접 입력한 이름. deviceModelId 와 둘 중 하나만 채운다. */
  @Column({ name: 'model_name', type: 'varchar', length: 100, nullable: true })
  modelName: string | null;

  /** 기기별 정원: 이번 범위에서는 항상 비워 둔다. */
  @Column({ name: 'device_capacity', type: 'int', nullable: true })
  deviceCapacity: number | null;
}
