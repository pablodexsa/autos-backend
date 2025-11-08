import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { Budget } from './budget.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { BudgetReportsModule } from '../budget-reports/budget-reports.module'; // 👈 agregado
import { LoanRate } from '../loan-rates/loan-rate.entity'; // ✅ Importa la entidad

@Module({
  imports: [
    TypeOrmModule.forFeature([Budget, Vehicle, Client, LoanRate]),
    BudgetReportsModule, // 👈 agregado
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
