import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';
import { Installment } from './installment.entity';
import { InstallmentPayment } from '../installment-payments/installment-payment.entity';
import { Sale } from '../sales/sale.entity';
import { Client } from '../clients/entities/client.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Installment,
      InstallmentPayment,
      Sale,
      Client,
    ]),
    AuditModule,
  ],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}