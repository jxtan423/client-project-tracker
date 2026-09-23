import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginBodyPipe, LoginDto } from './validation/login.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(@Body(new LoginBodyPipe()) input: LoginDto) {
    return this.auth.login(input);
  }
}
