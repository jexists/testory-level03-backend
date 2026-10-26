import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { AppError, conflict } from '../../common/app-error';
import { Role } from '../../common/enums';
import { MSG } from '../../common/messages';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

const BCRYPT_COST = 10;
// 없는 이메일로 로그인할 때도 비슷한 시간이 걸리도록 비교하는 더미 해시
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** 가입 화면에서는 일반 사용자만 만들 수 있다. role 은 요청에서 받지 않는다. */
  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.exists({ where: { email } })) throw conflict('EMAIL_TAKEN', MSG.EMAIL_TAKEN);
    const device = await this.usersService.toDeviceColumns(dto);

    try {
      const saved = await this.users.save(
        this.users.create({
          email,
          nickname: dto.nickname,
          passwordHash: await bcrypt.hash(dto.password, BCRYPT_COST),
          role: Role.USER,
          ...device,
        }),
      );
      const user = await this.users.findOneOrFail({ where: { id: saved.id }, relations: { deviceModel: true } });
      return { user, token: this.sign(user) };
    } catch (e) {
      if (e instanceof QueryFailedError && (e.driverError as { code?: string })?.code === '23505') {
        throw conflict('EMAIL_TAKEN', MSG.EMAIL_TAKEN);
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const row = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.deviceModel', 'dm')
      .where('u.email = :email', { email: dto.email.toLowerCase() })
      .getOne();
    const ok = await bcrypt.compare(dto.password, row?.passwordHash ?? DUMMY_HASH);
    if (!row || !ok) throw new AppError(HttpStatus.UNAUTHORIZED, 'LOGIN_FAILED', MSG.LOGIN_FAILED);
    return { user: row, token: this.sign(row) };
  }

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id });
  }
}
