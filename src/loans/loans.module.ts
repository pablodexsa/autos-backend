import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from './loan.entity';
import { LoanFundMovement } from './loan-fund-movement.entity';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { LoanClient } from '../loan-clients/loan-client.entity';
import { LoanInstallment } from '../loan-installments/loan-installment.entity';
import { LoanClientsModule } from '../loan-clients/loan-clients.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Loan,
      LoanClient,
      LoanInstallment,
      LoanFundMovement,
    ]),
    forwardRef(() => LoanClientsModule),
    AuditModule,
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}