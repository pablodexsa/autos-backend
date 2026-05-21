import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanInstallmentPayment } from './loan-installment-payment.entity';
import { LoanInstallmentPaymentsService } from './loan-installment-payments.service';
import { LoanInstallmentPaymentsController } from './loan-installment-payments.controller';
import { LoanInstallment } from '../loan-installments/loan-installment.entity';
import { Loan } from '../loans/loan.entity';
import { LoanClient } from '../loan-clients/loan-client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoanInstallmentPayment,
      LoanInstallment,
      Loan,
      LoanClient,
    ]),
  ],
  controllers: [LoanInstallmentPaymentsController],
  providers: [LoanInstallmentPaymentsService],
  exports: [LoanInstallmentPaymentsService],
})
export class LoanInstallmentPaymentsModule {}