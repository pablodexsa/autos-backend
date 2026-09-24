import {
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoanInstallmentsService } from './loan-installments.service';
import { ApplyLoanInstallmentPaymentDto } from './dto/apply-loan-installment-payment.dto';

@UseGuards(JwtAuthGuard)
@Controller('loan-installments')
export class LoanInstallmentsController {
  constructor(
    private readonly loanInstallmentsService: LoanInstallmentsService,
  ) {}

  @Get()
  findAll() {
    return this.loanInstallmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.loanInstallmentsService.findOne(id);
  }

  @Patch(':id/register-payment')
  registerPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyLoanInstallmentPaymentDto,
    @Req() req: any,
  ) {
    return this.loanInstallmentsService.applyPaymentToInstallment(
      id,
      dto.amount,
      dto.paymentDate,
      dto.observations,
      dto.treasuryAccountId,
      dto.treasuryPaymentMethod,
      req.user.id,
    );
  }
}