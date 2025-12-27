import { Body, Controller, Get, Put } from '@nestjs/common';
import { LoanRatesService } from './loan-rates.service';
import { UpdateLoanRatesMatrixDto } from './dto/update-loan-rates-matrix.dto';

@Controller('settings/loan-rates')
export class LoanRatesSettingsController {
  constructor(private readonly service: LoanRatesService) {}

  @Get()
  getMatrix() {
    return this.service.getSettingsMatrix();
  }

  @Put()
  updateMatrix(@Body() dto: UpdateLoanRatesMatrixDto) {
    return this.service.updateSettingsMatrix(dto);
  }
}
