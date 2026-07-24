import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashBoxMovement } from './cash-box-movement.entity';
import { CashBoxMovementsController } from './cash-box-movements.controller';
import { CashBoxMovementsService } from './cash-box-movements.service';

@Module({
  imports: [TypeOrmModule.forFeature([CashBoxMovement])],
  controllers: [CashBoxMovementsController],
  providers: [CashBoxMovementsService],
  exports: [CashBoxMovementsService],
})
export class CashBoxMovementsModule {}
