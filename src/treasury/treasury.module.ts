import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreasuryAccount } from './treasury-account.entity';
import { TreasuryAllocation } from './treasury-allocation.entity';
import { TreasuryCategory } from './treasury-category.entity';
import { TreasuryMovement } from './treasury-movement.entity';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
import { TreasuryPending } from './treasury-pending.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Purchase } from '../purchases/purchase.entity';
@Module({ imports: [TypeOrmModule.forFeature([TreasuryAccount, TreasuryCategory, TreasuryMovement, TreasuryAllocation, TreasuryPending, Vehicle, Purchase])], controllers: [TreasuryController], providers: [TreasuryService], exports: [TreasuryService] })
export class TreasuryModule {}
