import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoanInstallmentPaymentsService } from './loan-installment-payments.service';

@Controller('loan-installment-payments')
export class LoanInstallmentPaymentsController {
  constructor(
    private readonly paymentsService: LoanInstallmentPaymentsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }

  // Público para permitir abrir el PDF en una pestaña nueva.
  @Get(':id/receipt')
  async getReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.paymentsService.getReceipt(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo_pago_prestamo_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.end(pdfBuffer);
  }
}