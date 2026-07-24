import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialDashboardController } from './financial-dashboard.controller';
import { FinancialDashboardService } from './financial-dashboard.service';
import { Loan } from '../loans/loan.entity';
import { LoanInstallment } from '../loan-installments/loan-installment.entity';
import { LoanInstallmentPayment } from '../loan-installment-payments/loan-installment-payment.entity';
import { CashBoxMovement } from '../cash-box-movements/cash-box-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Loan,
      LoanInstallment,
      LoanInstallmentPayment,
      CashBoxMovement,
    ]),
  ],
  controllers: [FinancialDashboardController],
  providers: [FinancialDashboardService],
})
export class FinancialDashboardModule {}
