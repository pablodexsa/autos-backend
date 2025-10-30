import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetReport } from './budget-report.entity';
import { BudgetReportsService } from './budget-reports.service';
import { BudgetReportsController } from './budget-reports.controller';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BudgetReport, Vehicle, Client, User])],
  providers: [BudgetReportsService],
  controllers: [BudgetReportsController],
})
export class BudgetReportsModule {}
