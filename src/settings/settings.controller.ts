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

  // ✅ Monto de devolución de reserva
  private readonly RESERVATION_REFUND_AMOUNT_KEY = 'reservation.refundAmount';

  // 🏍️ Planes de motos
  private readonly MOTO_PLANS_KEY = 'moto.plans';

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

  // ======================================
  // 🔹 Límite de Financiación Personal
  // ======================================
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

  // ======================================
  // 🔹 Monto de Devolución de Reserva
  // ======================================
  @Get('reservations/refund-amount')
  async getReservationRefundAmount() {
    const reservationRefundAmount = await this.settings.getNumber(
      this.RESERVATION_REFUND_AMOUNT_KEY,
      750_000,
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

  // ======================================
  // 🏍️ Planes de motos configurables
  // ======================================
  @Get('moto-plans')
  async getMotoPlans() {
    const raw = await this.settings.get(this.MOTO_PLANS_KEY);

    if (!raw) {
      const defaultPlans = [
        {
          code: 'A',
          name: 'Plan A',
          installments: 12,
          downPayment: 800000,
          totalInstallments: 12,
          firstInstallmentsCount: 3,
          firstInstallmentAmount: 630000,
          remainingInstallmentAmount: 300000,
        },
        {
          code: 'B',
          name: 'Plan B',
          installments: 14,
          downPayment: 0,
          totalInstallments: 14,
          firstInstallmentsCount: 3,
          firstInstallmentAmount: 630000,
          remainingInstallmentAmount: 340000,
        },
        {
          code: 'C',
          name: 'Plan C',
          installments: 18,
          downPayment: 0,
          totalInstallments: 18,
          firstInstallmentsCount: 0,
          firstInstallmentAmount: 0,
          remainingInstallmentAmount: 350000,
        },
      ];

      await this.settings.set(
        this.MOTO_PLANS_KEY,
        JSON.stringify(defaultPlans),
      );

      return defaultPlans;
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  @Patch('moto-plans')
  async setMotoPlans(
    @Body()
    body: {
      plans: {
        code: string;
        name: string;
        installments: number;
        downPayment?: number;
        totalInstallments?: number;
        firstInstallmentsCount?: number;
        firstInstallmentAmount?: number;
        remainingInstallmentAmount?: number;
      }[];
    },
  ) {
    if (!Array.isArray(body?.plans)) {
      throw new BadRequestException('Formato inválido de planes');
    }

    const normalized = body.plans.map((p) => ({
      code: String(p.code || '').trim(),
      name: String(p.name || '').trim(),
      installments: Number(p.installments ?? 0),
      downPayment: Number(p.downPayment ?? 0),
      totalInstallments: Number(p.totalInstallments ?? p.installments ?? 0),
      firstInstallmentsCount: Number(p.firstInstallmentsCount ?? 0),
      firstInstallmentAmount: Number(p.firstInstallmentAmount ?? 0),
      remainingInstallmentAmount: Number(p.remainingInstallmentAmount ?? 0),
    }));

    await this.settings.set(
      this.MOTO_PLANS_KEY,
      JSON.stringify(normalized),
    );

    return { ok: true, plans: normalized };
  }
}