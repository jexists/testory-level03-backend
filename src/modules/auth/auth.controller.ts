import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private svc: AuthService) {}
  @Post('signup') signup(@Body() dto: SignupDto) { return this.svc.signup(dto); }
  @Post('login') @HttpCode(200) login(@Body() dto: LoginDto) { return this.svc.login(dto); }
}
