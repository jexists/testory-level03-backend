import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MSG } from '../../shared/constants/messages';
import type { Os } from '../../shared/types';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceModel } from './entities/device-model.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(DeviceModel) private models: Repository<DeviceModel>,
  ) {}

  /** R7: 모델은 활성 목록에서만, 모델 OS 와 내 OS 가 같아야 한다. */
  async checkDevice(os: Os, modelId: number) {
    const model = await this.models.findOne({ where: { id: modelId, isActive: true } });
    if (!model) throw new BadRequestException(MSG.PICK_MODEL);
    if (model.os !== os) throw new BadRequestException('선택한 모델이 내 OS와 맞지 않아요.');
    return model;
  }

  view(u: User) {
    return {
      id: u.id, email: u.email, nickname: u.nickname, role: u.role,
      deviceType: u.deviceType, deviceModelId: u.deviceModelId, deviceModel: u.deviceModel?.modelName ?? null,
    };
  }

  async get(id: number) {
    const u = await this.users.findOne({ where: { id }, relations: { deviceModel: true } });
    if (!u) throw new UnauthorizedException(MSG.NEED_LOGIN);
    return u;
  }

  async updateNickname(id: number, nickname: string) {
    if (!nickname?.trim()) throw new BadRequestException('닉네임을 입력해 주세요.');
    await this.users.update(id, { nickname: nickname.trim().slice(0, 50) });
    return this.view(await this.get(id));
  }

  async updateDevice(id: number, dto: UpdateDeviceDto) {
    await this.checkDevice(dto.deviceType, dto.deviceModelId);
    await this.users.update(id, { deviceType: dto.deviceType, deviceModelId: dto.deviceModelId });
    return this.view(await this.get(id));
  }

  listDeviceModels(os?: string) {
    return this.models.find({
      where: { isActive: true, ...(os === 'ANDROID' || os === 'IOS' ? { os } : {}) },
      order: { os: 'ASC', id: 'ASC' },
    });
  }
}
