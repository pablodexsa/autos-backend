import { Controller, Get, Patch, Body, BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  private readonly RESERVATION_AMOUNT_KEY = 'reservation.amount';
  private readonly PERSONAL_MAX_KEY = 'financing.personal.max';

  constructor(private readonly settings: SettingsService) {}

  // ================================
  // 🔹 Monto de reserva
  // ================================
  @Get('reservations/amount')
  async getReservationAmount() {
    const amount = await this.settings.getNumber(this.RESERVATION_AMOUNT_KEY, 500000);
    return { amount };
  }

  @Patch('reservations/amount')
  async setReservationAmount(@Body() body: { amount: number }) {
    const v = Number(body.amount);
    if (!Number.isFinite(v) || v <= 0) {
      throw new BadRequestException('Monto de reserva inválido');
    }

    await this.settings.set(this.RESERVATION_AMOUNT_KEY, String(v));
    return { ok: true, amount: v };
  }

  // ================================
  // 🔹 Límite de Financiación Personal (in-house)
  //     Clave: financing.personal.max
  // ================================

  /**
   * GET /settings/financing/personal-max
   * respuesta: { maxPersonalAmount: number }
   */
  @Get('financing/personal-max')
  async getPersonalMax() {
    const maxPersonalAmount = await this.settings.getNumber(
      this.PERSONAL_MAX_KEY,
      3_500_000, // valor por defecto si no existe
    );
    return { maxPersonalAmount };
  }

  /**
   * PATCH /settings/financing/personal-max
   * body: { maxPersonalAmount: number }
   */
  @Patch('financing/personal-max')
  async setPersonalMax(@Body() body: { maxPersonalAmount: number }) {
    const v = Number(body.maxPersonalAmount);
    if (!Number.isFinite(v) || v <= 0) {
      throw new BadRequestException('Monto máximo de financiación inválido');
    }

    await this.settings.set(this.PERSONAL_MAX_KEY, String(v));
    return { ok: true, maxPersonalAmount: v };
  }
}
