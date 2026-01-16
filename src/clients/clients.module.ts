import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Client } from './entities/client.entity';
import { AuditModule } from '../audit/audit.module'; // 👈 NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([Client]),
    AuditModule, // 👈 SE AGREGA AQUÍ
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
