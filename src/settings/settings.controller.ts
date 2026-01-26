import {
  Controller,
  Get,
  Patch,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  private readonly RESERVATION_AMOUNT_KEY = 'reservation.amount';
  private readonly PERSONAL_MAX_KEY = 'financing.personal.max';

  // ✅ NUEVO
  private readonly RESERVATION_REFUND_AMOUNT_KEY = 'reservation.refundAmount';

  constructor(private readonly settings: SettingsService) {}

  // ================================
  // 🔹 Monto de reserva configurable
  // ================================
  @Get('reservations/amount')
  async getReservationAmount() {
    const reservationAmount = await this.settings.getNumber(
      this.RESERVATION_AMOUNT_KEY,
      500_000,
    );
    return { reservationAmount };
  }

  @Patch('reservations/amount')
  async setReservationAmount(@Body() body: { reservationAmount: number }) {
    const v = Number(body.reservationAmount);
    if (!Number.isFinite(v) || v <= 0) {
      throw new BadRequestException('Monto de reserva inválido');
    }

    await this.settings.set(this.RESERVATION_AMOUNT_KEY, String(v));
    return { ok: true, reservationAmount: v };
  }

  // ================================
  // 🔹 Límite de Financiación Personal
  // ================================
  @Get('financing/personal-max')
  async getPersonalMax() {
    const maxPersonalAmount = await this.settings.getNumber(
      this.PERSONAL_MAX_KEY,
      3_500_000,
    );
    return { maxPersonalAmount };
  }

  @Patch('financing/personal-max')
  async setPersonalMax(@Body() body: { maxPersonalAmount: number }) {
    const v = Number(body.maxPersonalAmount);
    if (!Number.isFinite(v) || v <= 0) {
      throw new BadRequestException(
        'Monto máximo de financiación inválido',
      );
    }

    await this.settings.set(this.PERSONAL_MAX_KEY, String(v));
    return { ok: true, maxPersonalAmount: v };
  }

  // ================================
  // 🔹 Monto de Devolución de Reserva
  //     Clave: reservation.refundAmount
  // ================================
  @Get('reservations/refund-amount')
  async getReservationRefundAmount() {
    const reservationRefundAmount = await this.settings.getNumber(
      this.RESERVATION_REFUND_AMOUNT_KEY,
      750_000, // 🔹 valor inicial solicitado
    );
    return { reservationRefundAmount };
  }

  @Patch('reservations/refund-amount')
  async setReservationRefundAmount(
    @Body() body: { reservationRefundAmount: number },
  ) {
    const v = Number(body.reservationRefundAmount);
    if (!Number.isFinite(v) || v < 0) {
      throw new BadRequestException('Monto de devolución inválido');
    }

    await this.settings.set(this.RESERVATION_REFUND_AMOUNT_KEY, String(v));
    return { ok: true, reservationRefundAmount: v };
  }
}
