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

    const rawUrl: string = req.originalUrl || req.url || '';

    // Nombre del controlador (Vehicles, Sales, Audit, etc.)
    const controller = context.getClass().name.replace('Controller', '');

    // ✅ RUTAS / MÓDULOS QUE NO SE AUDITAN
    if (
      // ⛔ NO AUDITAR EL MÓDULO DE AUDITORÍA (para evitar ruido/bucles)
      controller === 'Audit' ||
      rawUrl.includes('/audit')
    ) {
      return next.handle();
    }

    const user = req.user;
    const ip = req.ip;

    // ✅ Acción = método HTTP (GET, POST, etc.)
    const action = req.method;

    // ✅ Handler (método del controlador)
    const handler = context.getHandler().name;

    // ✅ Path sin query params
    const cleanPath = rawUrl.split('?')[0];

    // ✅ Módulo legible
    const moduleName = `${controller} → ${cleanPath} → ${handler}()`;

    const details = {
      params: req.params,
      body: req.body,
      query: req.query,
    };

    return next.handle().pipe(
      tap(() => {
        // Para login/register (o cualquier request sin user), usamos 0 como "sistema/anónimo"
        const userId = user?.id ?? 0;

        this.auditService.log(userId, action, moduleName, details, ip);
      }),
    );
  }
}
