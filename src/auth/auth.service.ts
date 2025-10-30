import { Injectable, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ✅ Validar credenciales
  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(pass, user.password);
    } catch (e) {
      this.logger.error('Error al comparar contraseñas', e);
    }

    if (!isMatch && user.password !== pass) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    return user;
  }

  // ✅ Generar token compatible con el frontend
  async login(user: any) {
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role?.name || user.role || 'user',
      };

      const token = this.jwtService.sign(payload);

      return {
        token, // 👈 nombre esperado por el frontend
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name || user.role || 'user',
        },
      };
    } catch (error) {
      this.logger.error('Error generando token', error);
      throw new InternalServerErrorException('Error generando token JWT');
    }
  }

  // ✅ Login directo
  async signIn(email: string, password: string) {
    const user = await this.validateUser(email, password);
    return await this.login(user);
  }
}
