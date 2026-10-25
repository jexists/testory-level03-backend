import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private usersSvc: UsersService,
    private jwt: JwtService,
  ) {}

  /** 가입 화면에서는 일반 사용자(USER)만 만들 수 있다. */
  async signup(dto: SignupDto) {
    await this.usersSvc.checkDevice(dto.deviceType, dto.deviceModelId);
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findOne({ where: { email } })) throw new ConflictException('이미 가입된 이메일이에요. 로그인해 주세요.');
    const saved = await this.users.save(this.users.create({
      email, nickname: dto.nickname.trim(), role: 'USER', passwordHash: await bcrypt.hash(dto.password, 10),
      deviceType: dto.deviceType, deviceModelId: dto.deviceModelId,
    }));
    return this.token(await this.usersSvc.get(saved.id));
  }

  async login(dto: LoginDto) {
    const u = await this.users.findOne({ where: { email: dto.email.trim().toLowerCase() }, relations: { deviceModel: true } });
    if (!u || !(await bcrypt.compare(dto.password, u.passwordHash)))
      throw new UnauthorizedException('이메일 또는 비밀번호가 맞지 않아요.');
    return this.token(u);
  }

  private token(u: User) {
    return { token: this.jwt.sign({ sub: u.id, role: u.role }), user: this.usersSvc.view(u) };
  }
}
