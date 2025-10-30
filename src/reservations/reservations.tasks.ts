import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationsService } from './reservations.service';

@Injectable()
export class ReservationsTasks {
  private readonly logger = new Logger(ReservationsTasks.name);

  constructor(private readonly reservationsService: ReservationsService) {}

  private nowString(): string {
    return new Date().toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // 🕒 Cada hora: marca reservas vencidas
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpireReservations() {
    this.logger.log(`[${this.nowString()}] ⏰ Verificando reservas vencidas...`);
    await this.reservationsService.expirePastReservations();
    this.logger.log(`[${this.nowString()}] ✅ Verificación de vencimientos completada.`);
  }

  // 🌅 Cada día a medianoche: extiende reservas con garantes recientes
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExtendReservations() {
    this.logger.log(`[${this.nowString()}] 🔁 Verificando reservas con garantes nuevos...`);
    await this.reservationsService.extendReservationsWithNewGuarantors();
    this.logger.log(`[${this.nowString()}] ✅ Extensión automática completada.`);
  }
}
