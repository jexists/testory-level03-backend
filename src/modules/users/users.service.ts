import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { badRequest } from '../../common/app-error';
import { Os, OS_OTHER } from '../../common/enums';
import { MSG } from '../../common/messages';
import { DeviceModel } from './device-model.entity';
import type { DeviceInputDto } from './dto/device-input.dto';
import { User } from './user.entity';

export interface UserView {
  id: number;
  email: string;
  nickname: string;
  role: string;
  /** 목록에서 고른 OS. 직접 입력했다면 null 이고 deviceOsName 에 이름이 있다. */
  deviceType: Os | null;
  deviceOsName: string | null;
  /** 직접 입력한 모델이면 id 가 null 이다. */
  deviceModel: { id: number | null; modelName: string } | null;
}

export const toUserView = (u: User): UserView => ({
  id: u.id,
  email: u.email,
  nickname: u.nickname,
  role: u.role,
  deviceType: u.deviceType,
  deviceOsName: u.deviceOsName,
  deviceModel: u.deviceModel
    ? { id: u.deviceModel.id, modelName: u.deviceModel.modelName }
    : u.deviceModelName
      ? { id: null, modelName: u.deviceModelName }
      : null,
});

/** users 테이블에 저장할 기기 값. "기타"는 저장하지 않고 입력한 이름만 남긴다. */
export type DeviceColumns = Pick<User, 'deviceType' | 'deviceOsName' | 'deviceModelId' | 'deviceModelName'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DeviceModel) private readonly models: Repository<DeviceModel>,
  ) {}

  listModels(os?: Os) {
    return this.models.find({
      where: { isActive: true, ...(os ? { os } : {}) },
      order: { os: 'ASC', id: 'ASC' },
    });
  }

  /**
   * R7: 목록에서 고른 모델은 목록에 있어야 하고 내 OS 와 같아야 한다.
   * 목록에 없는 기기는 OS·모델 이름을 직접 입력한다. OS 를 직접 입력했다면 모델도 직접 입력한다.
   */
  async toDeviceColumns(dto: DeviceInputDto): Promise<DeviceColumns> {
    const osOther = dto.deviceType === OS_OTHER;
    if (dto.deviceModelId != null && dto.deviceModelName !== undefined) throw badRequest('INVALID_INPUT', MSG.INVALID_INPUT);
    if (osOther && dto.deviceModelId != null) throw badRequest('DEVICE_OS_MISMATCH', MSG.DEVICE_OS_MISMATCH);

    if (dto.deviceModelId != null) {
      const model = await this.models.findOne({ where: { id: dto.deviceModelId, isActive: true } });
      if (!model) throw badRequest('DEVICE_PICK_MODEL', MSG.DEVICE_PICK_MODEL);
      if (model.os !== dto.deviceType) throw badRequest('DEVICE_OS_MISMATCH', MSG.DEVICE_OS_MISMATCH);
    }
    return {
      deviceType: osOther ? null : (dto.deviceType as Os),
      deviceOsName: osOther ? dto.deviceOsName! : null,
      deviceModelId: dto.deviceModelId ?? null,
      deviceModelName: dto.deviceModelId == null ? dto.deviceModelName! : null,
    };
  }

  async updateDevice(userId: number, dto: DeviceInputDto) {
    await this.users.update({ id: userId }, await this.toDeviceColumns(dto));
    return this.users.findOneOrFail({ where: { id: userId }, relations: { deviceModel: true } });
  }
}
