import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
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

  async validateUser(email: string, pass: string) {
    console.log('🟦 VALIDANDO LOGIN', { email, pass });

    const user = await this.usersService.findByEmail(email);

    console.log('🟩 Usuario encontrado en DB:', user);

    if (!user) {
      console.log('❌ Usuario no encontrado en BD');
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const stored = user.password;
    const isHashed = stored?.startsWith('$2b$');

    console.log('🔐 HASH DETECTADO:', isHashed, stored);

    let isMatch = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(pass, stored);
    } else {
      isMatch = stored === pass;
    }

    console.log('✅ Resultado bcrypt.compare / texto plano:', isMatch);

    if (!isMatch) {
      console.log('❌ CONTRASEÑA INCORRECTA');
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    console.log('✅ LOGIN VALIDADO CORRECTAMENTE');

    return user;
  }

  // 🔐 LOGIN → ahora incluye permisos reales
  async login(user: any) {
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role?.name || user.role || 'user',
      };

      const token = this.jwtService.sign(payload);

      // ✅ Extraer permisos del rol
      const permissions: string[] =
        user.role?.rolePermissions
          ?.map((rp) => rp.permission?.code)
          .filter(Boolean) || [];

      return {
        access_token: token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name || user.role || 'user',
          permissions, // 👈 NUEVO
        },
      };
    } catch (error) {
      this.logger.error('Error generando token', error);
      throw new InternalServerErrorException('Error generando token JWT');
    }
  }

  async signIn(email: string, password: string) {
    const user = await this.validateUser(email, password);
    return await this.login(user);
  }
}
