import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    const user = req.user;
    const ip = req.ip;

    // ✅ Acción = método HTTP
    const action = req.method;

    // ✅ Módulo = controlador + handler o ruta base (LEGIBLE)
    const controller = context.getClass().name.replace('Controller', '');
    const handler = context.getHandler().name;

    // ✅ Path limpio sin query params
    const rawUrl = req.originalUrl || req.url;
    const cleanPath = rawUrl.split('?')[0];

    const moduleName = `${controller} → ${cleanPath} → ${handler}()`; 
    // Ejemplo: Vehicles → /api/vehicles → findAll()

    const details = {
      params: req.params,
      body: req.body,
      query: req.query,
    };

    return next.handle().pipe(
      tap(() => {
        if (user?.id) {
          this.auditService.log(
            user.id,
            action,
            moduleName,
            details,
            ip,
          );
        }
      }),
    );
  }
}
