import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installment } from './installment.entity';
import { Client } from '../clients/entities/client.entity';
import { Sale } from '../sales/sale.entity';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Installment, Client, Sale])],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
