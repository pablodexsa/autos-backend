import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // ⚠️ Ideal: proteger con guard de rol admin
  @Get('reservations/amount')
  async getReservationAmount() {
    const amount = await this.settings.getNumber('reservation.amount', 500000);
    return { amount };
  }

  // ⚠️ Ideal: proteger con guard de rol admin
  @Patch('reservations/amount')
  async setReservationAmount(@Body() body: { amount: number }) {
    const v = Number(body.amount);
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error('Monto inválido');
    }
    await this.settings.set('reservation.amount', String(v));
    return { ok: true, amount: v };
  }
}
