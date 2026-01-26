import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

import { Refund, RefundStatus } from './refund.entity';
import { DeliverRefundDto } from './dto/deliver-refund.dto';
import { SettingsService } from '../settings/settings.service';
import { Reservation } from '../reservations/reservation.entity';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);

@Injectable()
export class RefundsService {
  constructor(
    @InjectRepository(Refund)
    private readonly refundsRepo: Repository<Refund>,

    @InjectRepository(Reservation)
    private readonly reservationsRepo: Repository<Reservation>,

    private readonly settings: SettingsService,
  ) {}

  private readonly AR_TZ = 'America/Argentina/Buenos_Aires';

  private nowString(): string {
    return new Date().toLocaleString('es-AR', {
      timeZone: this.AR_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private formatDateTimeAR(d: Date): string {
    return d.toLocaleString('es-AR', {
      timeZone: this.AR_TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async findAll(params: { q?: string; status?: RefundStatus } = {}) {
    const qb = this.refundsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.deliveredByUser', 'u')
      .orderBy('r.canceledAt', 'DESC');

    if (params.status) {
      qb.andWhere('r.status = :status', { status: params.status });
    }

    if (params.q?.trim()) {
      const q = `%${params.q.trim()}%`;
      qb.andWhere(
        '(r.clientDni ILIKE :q OR r.plate ILIKE :q OR r.vehicleLabel ILIKE :q)',
        { q },
      );
    }

    return qb.getMany();
  }

  async deliver(refundId: number, dto: DeliverRefundDto, userId: number) {
    const refund = await this.refundsRepo.findOne({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('Devolución no encontrada');

    if (refund.status === RefundStatus.DELIVERED) {
      throw new BadRequestException('La devolución ya fue registrada como entregada');
    }

    const paidAmount =
      dto.paidAmount != null ? Number(dto.paidAmount) : Number(refund.expectedAmount);

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      throw new BadRequestException('Monto devuelto inválido');
    }

    refund.status = RefundStatus.DELIVERED;
    refund.paidAmount = paidAmount;
    refund.deliveredAt = new Date();
    refund.deliveredByUserId = userId;

    return this.refundsRepo.save(refund);
  }

  async getPdf(refundId: number): Promise<Buffer> {
    const refund = await this.refundsRepo.findOne({
      where: { id: refundId },
      relations: ['deliveredByUser'],
    });
    if (!refund) throw new NotFoundException('Devolución no encontrada');

    const reservation = await this.reservationsRepo.findOne({
      where: { id: refund.reservationId },
      relations: ['client', 'vehicle', 'guarantors', 'seller'],
    });

    // si por algún motivo la reserva no existe (raro), igual emitimos con lo que haya
    const clientName = reservation?.client
      ? `${reservation.client.firstName} ${reservation.client.lastName}`
      : 'Sin cliente';

    const sellerName = reservation?.seller
      ? (() => {
          const s: any = reservation.seller;
          return (
            `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ||
            s.name ||
            s.username ||
            ''
          );
        })()
      : '';

    const deliveredByName = refund.deliveredByUser
      ? (() => {
          const u: any = refund.deliveredByUser;
          return (
            `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
            u.name ||
            u.username ||
            ''
          );
        })()
      : '';

    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const fileName = `Comprobante-Devolucion-Reserva-${refund.id}-${dateString}.pdf`;

    const dir = path.join(__dirname, '../../uploads/refunds', String(refund.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    // Marca de agua (mismo logo que usás en reservas)
    try {
      const logoPath = path.join(__dirname, '../../logos/Logobyn.JPG');
      if (fs.existsSync(logoPath)) {
        doc.opacity(0.07).image(logoPath, 100, 180, {
          fit: [400, 400],
          align: 'center',
        });
        doc.opacity(1);
      }
    } catch {}

    // Header
    doc
      .fontSize(22)
      .fillColor('#1e1e1e')
      .text('DE GRAZIA AUTOMOTORES', { align: 'center' });
    doc
      .fontSize(12)
      .fillColor('#555')
      .text('Comprobante de Devolución de reserva', { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#777')
      .text(`Emitido el ${this.nowString()}`, { align: 'center' });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
    doc.moveDown(1);

    const sectionTitle = (t: string) => {
      doc.moveDown(0.6);
      doc.fontSize(13).fillColor('#009879').text(t.toUpperCase(), {
        underline: true,
      });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#1e1e1e');
    };

    sectionTitle('Datos de la Devolución');
    doc.text(`Número devolución: ${refund.id}`);
    doc.text(`Reserva #${refund.reservationId}`);
    doc.text(`Estado: ${refund.status === RefundStatus.PENDING ? 'Pendiente' : 'Entregada'}`);
    doc.text(`Fecha cancelación: ${this.formatDateTimeAR(new Date(refund.canceledAt))}`);
    doc.text(`Monto a devolver: ${pesos(Number(refund.expectedAmount))}`);

    if (refund.status === RefundStatus.DELIVERED) {
      doc.text(`Saldo abonado: ${pesos(Number(refund.paidAmount ?? 0))}`);
      doc.text(`Fecha de devolución: ${refund.deliveredAt ? this.formatDateTimeAR(new Date(refund.deliveredAt)) : '-'}`);
      if (deliveredByName) doc.text(`Entregada por: ${deliveredByName}`);
    }

    sectionTitle('Cliente');
    doc.text(clientName);
    doc.text(`DNI: ${refund.clientDni || '-'}`);

    sectionTitle('Vehículo');
    doc.text(refund.vehicleLabel || '-');
    doc.text(`Patente: ${refund.plate || '-'}`);

    if (sellerName) {
      sectionTitle('Vendedor');
      doc.text(sellerName);
    }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();

    // Footer (copiado de tu estilo)
    try {
      const logoPath = path.join(__dirname, '../../public/Logobyn.JPG');
      const footerY = doc.y + 5;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, footerY, { fit: [40, 40] });
      }
      doc
        .fontSize(8)
        .fillColor('#777')
        .text(
          'De Grazia Automotores · Bolívar 1242 · Longchamps · Tel: +54 9 11 2850-5895',
          110,
          footerY + 10,
          { align: 'left' },
        );
    } catch {
      doc
        .fontSize(8)
        .fillColor('#777')
        .text(
          'De Grazia Automotores · Bolívar 1242 · Longchamps · Tel: +54 9 11 2850-5895',
          { align: 'center' },
        );
    }

    doc.end();
    await done;

    const pdfBuffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, pdfBuffer);

    return pdfBuffer;
  }

  /**
   * Se usa desde ReservationsService.update() al cancelar.
   * Crea la devolución si no existe (1 por reserva).
   */
  async ensureRefundFromCancel(reservation: Reservation, canceledAt: Date) {
    const existing = await this.refundsRepo.findOne({
      where: { reservationId: reservation.id },
    });
    if (existing) return existing;

    const refundAmount = await this.settings.getNumber(
      'reservation.refundAmount',
      750_000,
    );

    const refund = this.refundsRepo.create({
      reservationId: reservation.id,
      clientDni: reservation.client?.dni || '',
      plate: reservation.plate || reservation.vehicle?.plate || '',
      vehicleLabel: reservation.vehicleLabel || '',
      canceledAt: canceledAt ?? new Date(),
      status: RefundStatus.PENDING,
      expectedAmount: Number(refundAmount),
      paidAmount: null,
      deliveredAt: null,
      deliveredByUserId: null,
    });

    return this.refundsRepo.save(refund);
  }
}
