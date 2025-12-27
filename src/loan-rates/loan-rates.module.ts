import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanRate } from './loan-rate.entity';
import { LoanRatesService } from './loan-rates.service';
import { LoanRatesController } from './loan-rates.controller';
import { LoanRatesSettingsController } from './loan-rates-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LoanRate])],
  providers: [LoanRatesService],
  controllers: [LoanRatesController, LoanRatesSettingsController],
  exports: [LoanRatesService],
})
export class LoanRatesModule {}
