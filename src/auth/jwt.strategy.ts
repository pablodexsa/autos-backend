import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'default-secret-key-change-this',
    });
  }

  async validate(payload: any) {
    // payload.sub viene del login()
    const user = await this.usersService.findOne(Number(payload.sub));

    if (!user) {
      throw new UnauthorizedException(
        'Token inválido o usuario no encontrado',
      );
    }

    // ✅ Asegurar permissions en req.user (aunque el entity no tenga esa prop tipada)
    const permissions: string[] =
      (user as any)?.role?.rolePermissions
        ?.map((rp: any) => rp?.permission?.code)
        .filter(Boolean) || [];

    // ⚠️ Devolvemos un objeto "liviano" para que req.user sea estable
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role, // puede ser objeto Role
      permissions,
    };
  }
}
