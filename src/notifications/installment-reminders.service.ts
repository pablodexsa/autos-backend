import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Installment,
  InstallmentStatus,
} from '../installments/installment.entity';
import { NotificationLog, NotificationKind } from './notification-log.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InstallmentRemindersService {
  private readonly logger = new Logger(InstallmentRemindersService.name);
  private readonly AR_TZ = 'America/Argentina/Buenos_Aires';

  constructor(
    @InjectRepository(Installment)
    private readonly instRepo: Repository<Installment>,

    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,

    private readonly mailService: MailService,
  ) {}

  // ✅ Corre todos los días 09:00 AM hora AR
  @Cron('0 9 * * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async runDaily() {
    await this.sendForOffsetDays(5);
    await this.sendForOffsetDays(2);
    await this.sendForOffsetDays(0);
  }

  private ymdInTz(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.AR_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`; // YYYY-MM-DD
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private kindForOffset(days: number): NotificationKind {
    if (days === 5) return 'INSTALLMENT_DUE_5';
    if (days === 2) return 'INSTALLMENT_DUE_2';
    return 'INSTALLMENT_DUE_0';
  }

  private formatMoneyARS(n: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(n || 0));
  }

  private safeName(first?: string | null, last?: string | null): string {
    const full = `${first ?? ''} ${last ?? ''}`.trim();
    return full || 'Cliente';
  }

  private quotaLabel(inst: Installment): string {
    if (inst.installmentNumber && inst.totalInstallments) {
      return `#${inst.installmentNumber}/${inst.totalInstallments}`;
    }
    return `#${inst.id}`;
  }

  private async sendForOffsetDays(daysBeforeDue: number) {
    const kind = this.kindForOffset(daysBeforeDue);

    const today = new Date();
    const target = this.addDays(today, daysBeforeDue);
    const targetYmd = this.ymdInTz(target);

    // ✅ dueDate ahora es DATE en Postgres, así que NO usamos rangos horarios.
    // Buscamos por igualdad de fecha (YYYY-MM-DD).
    const installments = await this.instRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.client', 'client')
      // sale no es relación en tu entity (tenés saleId), así que no lo joineamos
      .where('i.paid = false')
      .andWhere('i.status = :status', { status: InstallmentStatus.PENDING })
      .andWhere('i."dueDate" = :d', { d: targetYmd })
      .getMany();

    if (!installments.length) {
      this.logger.log(`No hay cuotas para ${kind} (${targetYmd})`);
      return;
    }

    for (const inst of installments) {
      const client = (inst as any).client; // viene por join
      const clientEmail: string | undefined = client?.email;

      if (!clientEmail) {
        // sin email: no es error, solo skip
        this.logger.warn(
          `Cuota ${this.quotaLabel(inst)} sin email (clientId=${inst.clientId})`,
        );
        continue;
      }

      // ✅ anti-duplicado (unique index). Si ya existe log, skip.
      const existing = await this.logRepo.findOne({
        where: {
          kind,
          channel: 'email',
          installmentId: inst.id,
        } as any,
      });
      if (existing) continue;

      const dueDateStr = targetYmd; // como DATE, mostramos YYYY-MM-DD (evita problemas de TZ)
      const amount = Number(inst.remainingAmount ?? inst.amount ?? 0);

      const subject =
        daysBeforeDue === 0
          ? `Hoy vence tu cuota (${this.quotaLabel(inst)})`
          : `Recordatorio: tu cuota vence en ${daysBeforeDue} día(s) (${this.quotaLabel(
              inst,
            )})`;

      const clientName = this.safeName(client?.firstName, client?.lastName);

      const html = `
        <p>Hola ${clientName},</p>

        <p>
          ${
            daysBeforeDue === 0
              ? 'Te recordamos que <strong>hoy</strong> vence tu cuota para evitar intereses.'
              : `Te recordamos que tu cuota vence en <strong>${daysBeforeDue} día(s)</strong> para evitar intereses.`
          }
        </p>

        <ul>
          <li><strong>Vencimiento:</strong> ${dueDateStr}</li>
          <li><strong>Cuota:</strong> ${inst.installmentNumber ?? '-'} / ${
        inst.totalInstallments ?? '-'
      }</li>
          <li><strong>Importe a pagar:</strong> ${this.formatMoneyARS(amount)}</li>
        </ul>

        <p>
          Si ya realizaste el pago, podés ignorar este mensaje.
        </p>

        <p>
          Saludos,<br/>
          <strong>GL Motors</strong>
        </p>
      `;

      try {
        // ✅ Requiere que tu MailService tenga sendHtml({to, subject, html})
        await this.mailService.sendHtml({
          to: clientEmail,
          subject,
          html,
        });

        await this.logRepo.save(
          this.logRepo.create({
            kind,
            channel: 'email',
            installmentId: inst.id,
            saleId: inst.saleId ?? null,
            clientId: inst.clientId ?? client?.id ?? null,
            dueDate: targetYmd,
            status: 'SENT',
            error: null,
          } as any),
        );

        this.logger.log(
          `✅ Reminder ${kind} enviado a ${clientEmail} (inst ${inst.id})`,
        );
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? 'Unknown error');

        // Guardamos log en ERROR para tener evidencia, y evitar spam de reintentos infinitos.
        await this.logRepo.save(
          this.logRepo.create({
            kind,
            channel: 'email',
            installmentId: inst.id,
            saleId: inst.saleId ?? null,
            clientId: inst.clientId ?? client?.id ?? null,
            dueDate: targetYmd,
            status: 'ERROR',
            error: msg,
          } as any),
        );

        this.logger.error(
          `❌ Error enviando reminder ${kind} a ${clientEmail} (inst ${inst.id}): ${msg}`,
        );
      }
    }
  }
}
