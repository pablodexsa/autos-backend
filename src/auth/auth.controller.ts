import { Controller, Post, Body, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // ✅ Login
  @Post('login')
  async login(@Body('email') email: string, @Body('password') password: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Email y contraseña requeridos');
    }

    try {
      const result = await this.authService.signIn(email, password);
      this.logger.log(`Login exitoso para ${email}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al iniciar sesión: ${error.message}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }

  // ✅ Registro (opcional)
  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new UnauthorizedException('El usuario ya existe');
    }

    const newUser = await this.usersService.create(dto);
    return this.authService.login(newUser);
  }
}
