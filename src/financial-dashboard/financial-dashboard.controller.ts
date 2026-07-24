import { Controller, Get, Query } from '@nestjs/common';
import { FinancialDashboardService } from './financial-dashboard.service';

@Controller('financial-dashboard')
export class FinancialDashboardController {
  constructor(private readonly service: FinancialDashboardService) {}

  @Get('summary')
  getSummary(@Query('date') date?: string) {
    return this.service.getSummary(date);
  }
}
