import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './sale.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Installment } from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';
import { InstallmentsModule } from '../installments/installments.module';
import { ClientsModule } from '../clients/clients.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { LoanRate } from '../loan-rates/loan-rate.entity';
import { AuditModule } from '../audit/audit.module'; // 👈 NUEVO
import { MailModule } from '../mail/mail.module'; // ✅ NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      Vehicle,
      Reservation,
      Installment,
      Client,
      LoanRate,
    ]),
    forwardRef(() => InstallmentsModule),
    forwardRef(() => ClientsModule),
    forwardRef(() => VehiclesModule),
    AuditModule, // 👈 SE AGREGA AQUÍ
    MailModule, // ✅ para poder inyectar MailService en SalesService
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

