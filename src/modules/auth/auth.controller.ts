import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(body.email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const validated = await this.authService.validateUser(body.email, body.password);
    if (!validated) throw new UnauthorizedException('Credenciales inválidas');
    return this.authService.login(user);
  }
}
