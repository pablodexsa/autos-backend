import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanClient } from './loan-client.entity';
import { LoanClientsService } from './loan-clients.service';
import { LoanClientsController } from './loan-clients.controller';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([LoanClient]), CloudinaryModule, AuditModule],
  controllers: [LoanClientsController],
  providers: [LoanClientsService],
  exports: [LoanClientsService],
})
export class LoanClientsModule {}