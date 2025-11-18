import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallmentPayment } from './installment-payment.entity';
import { InstallmentPaymentService } from './installment-payment.service';
import { InstallmentPaymentController } from './installment-payment.controller';
import { Installment } from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstallmentPayment,
      Installment,
      Client, // ✅ <-- AGREGA ESTA LÍNEA
    ]),
  ],
  controllers: [InstallmentPaymentController],
  providers: [InstallmentPaymentService],
})
export class InstallmentPaymentModule {}
