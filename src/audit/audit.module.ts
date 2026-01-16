import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit.entity';          // 👈 USA EL NOMBRE REAL DE LA CLASE
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],  // 👈 MISMO NOMBRE AQUÍ
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
