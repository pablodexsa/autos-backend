import { Controller, Post, Body, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Public } from './decorators/public.decorator';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // ✅ LOGIN (PÚBLICO)
  @Public()
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string
  ) {
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

  // ✅ REGISTER (PÚBLICO, OPCIONAL)
  @Public()
  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new UnauthorizedException('El usuario ya existe');
    }
    const newUser = await this.usersService.create(dto);
    return this.authService.login(newUser);
  }

  // ✅ RESET PASSWORD ADMIN (NUEVO)
  @Public()
  @Post('reset-admin-password')
  async resetAdminPassword() {
    const email = 'admin@degrazia.com';
    const newPass = 'Ninguno123!';

    const hashed = await bcrypt.hash(newPass, 10);

    let admin = await this.usersService.findByEmail(email);

    if (!admin) {
      // ✅ Crear si no existe
      admin = await this.usersService.create({
        name: 'Administrador',
        email,
        password: hashed,
        isActive: true,
        roleId: 1,
      });
    } else {
      // ✅ Actualizar si existe
      await this.usersService.update(admin.id, { password: hashed });
    }

    return {
      ok: true,
      message: '✅ Contraseña del ADMIN reseteada correctamente',
      email,
      newPass,
    };
  }
}
