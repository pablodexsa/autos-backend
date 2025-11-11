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

    const user = req.user; // viene del JWT
    const module = req.route?.path || "unknown";
    const action = req.method;
    const ip = req.ip;

    const details = {
      params: req.params,
      query: req.query,
      body: req.body,
    };

    return next.handle().pipe(
      tap(() => {
        if (user?.id) {
          this.auditService.log(
            user.id,
            action,
            module,
            details,
            ip,
          );
        }
      })
    );
  }
}
