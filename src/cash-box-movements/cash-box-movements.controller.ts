import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CashBoxMovementsService } from './cash-box-movements.service';

@UseGuards(JwtAuthGuard)
@Controller('cash-box-movements')
export class CashBoxMovementsController {
  constructor(private readonly service: CashBoxMovementsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }
}
