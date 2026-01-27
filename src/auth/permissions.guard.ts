import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    const userPermissions: string[] =
      user?.role?.rolePermissions?.map((rp) => rp.permission?.code).filter(Boolean) || [];

    const ok = required.every((p) => userPermissions.includes(p));

    if (!ok) {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }

    return true;
  }
}
