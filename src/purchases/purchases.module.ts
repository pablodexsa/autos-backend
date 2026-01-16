import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { Purchase } from './purchase.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { AuditModule } from '../audit/audit.module'; // 👈 NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, Vehicle, Client]),
    AuditModule, // 👈 SE AGREGA AQUÍ
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
