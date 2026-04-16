import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JudicialExecution } from './judicial-execution.entity';
import { JudicialExecutionsService } from './judicial-executions.service';
import { JudicialExecutionsController } from './judicial-executions.controller';
import { Client } from '../clients/entities/client.entity';
import { Installment } from '../installments/installment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JudicialExecution, Client, Installment])],
  controllers: [JudicialExecutionsController],
  providers: [JudicialExecutionsService],
  exports: [JudicialExecutionsService],
})
export class JudicialExecutionsModule {}