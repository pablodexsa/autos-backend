import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { ApiTags } from '@nestjs/swagger';
import { ApplyInstallmentPaymentDto } from './dto/apply-installment-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Installments')
@UseGuards(JwtAuthGuard) // 👈 necesario para que Auditoría registre el usuario
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
    @Req() req: any,
  ) {
    return this.installmentsService.applyPaymentToInstallment(
      id,
      dto.amount,
      dto.paymentDate,
      dto.receiver,
      dto.observations,
      dto.treasuryAccountId,
      dto.treasuryPaymentMethod,
      req.user.id,
    );
  }

  // Legacy bloqueado: un cobro debe pasar por register-payment para mantener
  // cuota + pago + Tesorería dentro del mismo circuito.
  @Patch(':id/pay')
  markAsPaid(@Param('id', ParseIntPipe) _id: number) {
    throw new BadRequestException(
      'Endpoint legacy deshabilitado. Registre el cobro mediante /installments/:id/register-payment.',
    );
  }

  // Legacy bloqueado: una anulación requiere un circuito contable que revierta
  // también el pago y el movimiento de Tesorería.
  @Patch(':id/unpay')
  markAsUnpaid(@Param('id', ParseIntPipe) _id: number) {
    throw new BadRequestException(
      'La reversión directa de cuotas está deshabilitada. Debe utilizarse un circuito de anulación contable.',
    );
  }

  // Legacy bloqueado: no borrar cuotas que puedan tener pagos/Tesorería asociados.
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) _id: number) {
    throw new BadRequestException(
      'La eliminación directa de cuotas está deshabilitada para preservar pagos, Tesorería y auditoría.',
    );
  }
}
