import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallmentPayment } from './installment-payment.entity';
import { InstallmentPaymentService } from './installment-payment.service';
import { InstallmentPaymentController } from './installment-payment.controller';
import { Installment } from '../installments/installment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InstallmentPayment, Installment])],
  controllers: [InstallmentPaymentController],
  providers: [InstallmentPaymentService],
  exports: [InstallmentPaymentService],
})
export class InstallmentPaymentModule {}
