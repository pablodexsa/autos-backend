import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { BudgetReportsService } from './budget-reports.service';
import { CreateBudgetReportDto } from './dto/create-budget-report.dto';
import type { Request } from 'express';
import { Req } from '@nestjs/common';


@Controller('budget-reports')
export class BudgetReportsController {
  constructor(private readonly service: BudgetReportsService) {}

@Post()
async create(@Req() req: Request, @Body() dto: CreateBudgetReportDto) {
  console.log('🧾 RAW BODY (req.body):', req.body);
  console.log('📥 DTO recibido en backend:', dto);
  return this.service.create(dto);
}


  @Get()
  findAll(
    @Query('plate') plate?: string,
    @Query('dni') dni?: string,
    @Query('seller') seller?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll({ plate, dni, seller, startDate, endDate });
  }
}
