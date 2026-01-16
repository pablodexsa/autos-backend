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

@UseGuards(JwtAuthGuard) // 👈 necesario para que Auditoría registre el usuario
@Controller('settings')
export class SettingsController {
  private readonly RESERVATION_AMOUNT_KEY = 'reservation.amount';
  private readonly PERSONAL_MAX_KEY = 'financing.personal.max';

  constructor(private readonly settings: SettingsService) {}

  // ================================
  // 🔹 Monto de reserva configurable
  //     Clave: reservation.amount
  // ================================
  @Get('reservations/amount')
  async getReservationAmount() {
    const reservationAmount = await this.settings.getNumber(
      this.RESERVATION_AMOUNT_KEY,
      500_000, // valor por defecto
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
  // 🔹 Límite de Financiación Personal (in-house)
  //     Clave: financing.personal.max
  // ================================
  @Get('financing/personal-max')
  async getPersonalMax() {
    const maxPersonalAmount = await this.settings.getNumber(
      this.PERSONAL_MAX_KEY,
      3_500_000, // fallback si no existe
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
}
