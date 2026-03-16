import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ManagerDashboardDto } from './dto/manager-dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('manager')
  getManagerDashboard(): Promise<ManagerDashboardDto> {
    return this.dashboardService.getManagerDashboard();
  }
}