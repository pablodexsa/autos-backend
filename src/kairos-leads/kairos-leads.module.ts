import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KairosLead } from './kairos-lead.entity';
import { KairosLeadsService } from './kairos-leads.service';
import { KairosLeadsController } from './kairos-leads.controller';
import { BcraService } from './bcra.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KairosLead]),
    AuditModule,
  ],
  controllers: [KairosLeadsController],
  providers: [KairosLeadsService, BcraService],
  exports: [KairosLeadsService],
})
export class KairosLeadsModule {}