import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { ApiTags } from '@nestjs/swagger';
import { ApplyInstallmentPaymentDto } from './dto/apply-installment-payment.dto';

@ApiTags('Installments')
@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  // 📋 Listar cuotas
  @Get()
  findAll() {
    return this.installmentsService.findAll();
  }

  // 🔎 Obtener una cuota por ID
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.findOne(id);
  }

  // 💳 Registrar pago total o parcial
  @Patch(':id/register-payment')
  registerPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyInstallmentPaymentDto,
  ) {
    return this.installmentsService.applyPaymentToInstallment(
      id,
      dto.amount,
      dto.paymentDate,
      dto.receiver,
      dto.observations,
    );
  }

  // Marca como pagada de forma directa (sigue disponible)
  @Patch(':id/pay')
  markAsPaid(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.markAsPaid(id);
  }

  // Revertir pago y volver a pendiente
  @Patch(':id/unpay')
  markAsUnpaid(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.markAsUnpaid(id);
  }

  // 🗑️ Eliminar cuota
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.remove(id);
  }
}
