import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreasuryAccount } from './treasury-account.entity';
import { TreasuryAllocation } from './treasury-allocation.entity';
import { TreasuryCategory } from './treasury-category.entity';
import { TreasuryMovement } from './treasury-movement.entity';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
@Module({ imports: [TypeOrmModule.forFeature([TreasuryAccount, TreasuryCategory, TreasuryMovement, TreasuryAllocation])], controllers: [TreasuryController], providers: [TreasuryService], exports: [TreasuryService] })
export class TreasuryModule {}
