import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanInstallment } from './loan-installment.entity';
import { LoanInstallmentsService } from './loan-installments.service';
import { LoanInstallmentsController } from './loan-installments.controller';
import { LoanInstallmentPayment } from '../loan-installment-payments/loan-installment-payment.entity';
import { Loan } from '../loans/loan.entity';
import { LoanClient } from '../loan-clients/loan-client.entity';
import { LoanFundMovement } from '../loans/loan-fund-movement.entity';
import { LoansModule } from '../loans/loans.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoanInstallment,
      LoanInstallmentPayment,
      Loan,
      LoanClient,
      LoanFundMovement,
    ]),
    forwardRef(() => LoansModule),
    AuditModule,
  ],
  controllers: [LoanInstallmentsController],
  providers: [LoanInstallmentsService],
  exports: [LoanInstallmentsService],
})
export class LoanInstallmentsModule {}