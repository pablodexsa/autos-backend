import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { PreviewLoanDto } from './dto/preview-loan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('preview')
  @UseGuards(JwtAuthGuard)
  preview(@Body() dto: PreviewLoanDto) {
    return this.loansService.preview(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateLoanDto) {
    return this.loansService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.loansService.findAll();
  }

  @Get('fund-summary')
  @UseGuards(JwtAuthGuard)
  fundSummary() {
    return this.loansService.getFundSummary();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.loansService.findOne(id);
  }

  // Público para poder abrirlo con window.open() en una pestaña nueva.
  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdfBuffer = await this.loansService.getPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="prestamo_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.end(pdfBuffer);
  }
}