import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { badRequest } from '../../common/app-error';
import { Os } from '../../common/enums';
import { MSG } from '../../common/messages';
import { DeviceModel } from './device-model.entity';
import { User } from './user.entity';

export interface UserView {
  id: number;
  email: string;
  nickname: string;
  role: string;
  deviceType: Os | null;
  deviceModel: { id: number; modelName: string } | null;
}

export const toUserView = (u: User): UserView => ({
  id: u.id,
  email: u.email,
  nickname: u.nickname,
  role: u.role,
  deviceType: u.deviceType,
  deviceModel: u.deviceModel ? { id: u.deviceModel.id, modelName: u.deviceModel.modelName } : null,
});

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

  /** R7: 모델은 목록에 있는 것만, 고른 모델의 OS 와 내 OS 가 같아야 한다. */
  async validateDevice(deviceType: Os, deviceModelId: number): Promise<DeviceModel> {
    const model = await this.models.findOne({ where: { id: deviceModelId, isActive: true } });
    if (!model) throw badRequest('DEVICE_PICK_MODEL', MSG.DEVICE_PICK_MODEL);
    if (model.os !== deviceType) throw badRequest('DEVICE_OS_MISMATCH', MSG.DEVICE_OS_MISMATCH);
    return model;
  }

  async updateDevice(userId: number, deviceType: Os, deviceModelId: number) {
    await this.validateDevice(deviceType, deviceModelId);
    await this.users.update({ id: userId }, { deviceType, deviceModelId });
    return this.users.findOneOrFail({ where: { id: userId }, relations: { deviceModel: true } });
  }
}
