import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reservation } from './reservation.entity';
import { Guarantor } from './guarantor.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';

// ✅ NUEVO (módulo Devoluciones)
import { Refund, RefundStatus } from '../refunds/refund.entity';

import { Subject } from 'rxjs';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);

type GuarantorDocKind = 'dni' | 'payslip';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationsRepo: Repository<Reservation>,

    @InjectRepository(Guarantor)
    private guarantorRepo: Repository<Guarantor>,

    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,

    @InjectRepository(Client)
    private clientRepo: Repository<Client>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Refund)
    private refundsRepo: Repository<Refund>,

    private readonly dataSource: DataSource,

    private readonly settings: SettingsService,

    private readonly mailService: MailService,
  ) {}

  // ============================
  // SSE (si lo usás)
  // ============================
  private updates$ = new Subject<{ type: 'created' | 'updated' | 'deleted'; id?: number }>();
  getUpdatesStream() {
    return this.updates$.asObservable();
  }
  private notify(type: 'created' | 'updated' | 'deleted', id?: number) {
    this.updates$.next({ type, id });
  }

  private readonly AR_TZ = 'America/Argentina/Buenos_Aires';

  private formatDateTimeAR(d: Date): string {
    return d.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getHolidaySet(): Set<string> {
    const raw = (process.env.AR_HOLIDAYS ?? '').trim();
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return new Set(items);
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
    return `${y}-${m}-${d}`;
  }

  private weekdayInTz(date: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.AR_TZ,
      weekday: 'short',
    }).formatToParts(date);

    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[wd] ?? 0;
  }

  private isBusinessDay(date: Date, holidays: Set<string>): boolean {
    const wd = this.weekdayInTz(date);
    if (wd === 0) return false;
    const ymd = this.ymdInTz(date);
    if (holidays.has(ymd)) return false;
    return true;
  }

  private plusHours(d: Date, hours: number) {
    const holidays = this.getHolidaySet();
    let remaining = hours;
    let cur = new Date(d);

    while (remaining > 0) {
      cur = new Date(cur.getTime() + 60 * 60 * 1000);
      if (this.isBusinessDay(cur, holidays)) remaining--;
    }
    return cur;
  }

  private nowString(): string {
    return new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  async findAll() {
    const list = await this.reservationsRepo.find({
      relations: ['client', 'vehicle', 'guarantors', 'seller'],
      order: { id: 'DESC' },
    });

    return list.map((r) => {
      const seller = r.seller as any;
      const sellerFullName = seller
        ? `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim() ||
          seller.name ||
          seller.username ||
          null
        : null;

      return {
        id: r.id,
        clientDni: r.client?.dni || '-',
        clientName: r.client ? `${r.client.firstName} ${r.client.lastName}` : 'Sin cliente',
        vehicle: r.vehicle
          ? `${r.vehicle.brand} ${r.vehicle.model} ${r.vehicle.versionName || ''}`
          : 'Sin vehículo',
        plate: r.vehicle?.plate || '-',
        date: r.date,
        status: r.status,
        updatedAt: r.updatedAt,
        guarantors: r.guarantors ?? [],
        sellerName: sellerFullName,
      };
    });
  }

  async findOne(id: number) {
    const reservation = await this.reservationsRepo.findOne({
      where: { id },
      relations: ['client', 'vehicle', 'guarantors', 'seller'],
    });
    if (!reservation) throw new NotFoundException(`Reserva con ID ${id} no encontrada`);
    return reservation;
  }

  async create(dto: {
    clientDni?: string;
    clientId?: number;
    plate: string;
    amount?: number;
    sellerId?: number;
    date?: string;
  }) {
    let client: Client | null = null;

    if (dto.clientId) {
      client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    } else if (dto.clientDni) {
      client = await this.clientRepo.findOne({ where: { dni: dto.clientDni } });
    }

    if (!client) throw new BadRequestException('Cliente no encontrado por DNI/ID');

    const vehicle = await this.vehicleRepo.findOne({ where: { plate: dto.plate } });
    if (!vehicle) throw new BadRequestException('Vehículo no encontrado');
    if (vehicle.sold) throw new BadRequestException('El vehículo está vendido');
    if (vehicle.status?.toLowerCase() === 'reserved') {
      throw new BadRequestException('El vehículo ya está reservado');
    }

    const sellerEntity = dto.sellerId
      ? ((await this.userRepo.findOne({ where: { id: dto.sellerId } })) as any)
      : undefined;

    const date = dto.date ? new Date(dto.date) : new Date();
    const expiry = this.plusHours(date, 48);

    const defaultAmount = await this.settings.getNumber('reservation.amount', 500_000);
    const amount = dto.amount != null ? Number(dto.amount) : defaultAmount;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Monto de reserva inválido');
    }

    const reservation = this.reservationsRepo.create({
      client,
      vehicle,
      seller: sellerEntity,
      amount,
      date,
      expiryDate: expiry,
      status: 'Vigente',
      updatedAt: new Date(),
      plate: vehicle.plate,
      vehicleLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.versionName || ''}`.trim(),
    });

    const saved = await this.reservationsRepo.save(reservation);

    vehicle.status = 'reserved';
    await this.vehicleRepo.save(vehicle);

    this.notify('created', saved.id);

    // ✅ Email con PDF (igual que lo tenías)
    try {
      const clientEmail = (client as any)?.email;
      if (clientEmail) {
        const pdfBuffer = await this.getPdf(saved.id);

        const vehicleLabel =
          saved.vehicleLabel ||
          `${vehicle.brand} ${vehicle.model} ${vehicle.versionName || ''}`.trim();

        const html = `
          <p>Hola ${client?.firstName ?? ''} ${client?.lastName ?? ''},</p>
          <p>Te confirmamos que la reserva fue registrada correctamente.</p>
          <ul>
            <li><strong>Reserva Nº:</strong> ${saved.id}</li>
            <li><strong>Vehículo:</strong> ${vehicleLabel}</li>
            <li><strong>Patente:</strong> ${vehicle.plate}</li>
            <li><strong>Importe de reserva:</strong> ${pesos(Number(saved.amount))}</li>
            <li><strong>Fecha:</strong> ${new Date(saved.date).toLocaleDateString('es-AR')}</li>
            <li><strong>Vigencia hasta:</strong> ${this.formatDateTimeAR(new Date(saved.expiryDate))}</li>
          </ul>
          <p>Adjunto vas a encontrar el comprobante en PDF.</p>
          <p>Saludos,<br/><strong>GL Motors</strong></p>
        `;

        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        const lastName = client?.lastName || 'Cliente';
        const filename = `Reserva-${lastName}-${dateString}-${saved.id}.pdf`;

        await this.mailService.sendWithPdf({
          to: clientEmail,
          subject: `Reserva #${saved.id} - ${vehicleLabel}`,
          filename,
          pdfBuffer,
          html,
        });
      }
    } catch (err) {
      console.error(`❌ No se pudo enviar la reserva ${saved.id} por email (se creó igual):`, err);
    }

    return saved;
  }

  // ✅ update (lo dejo igual, con transacción + refunds)
  async update(id: number, dto: { status?: Reservation['status'] }) {
    const res = await this.findOne(id);

    const nextStatus = dto.status;
    if (!nextStatus) return res;

    const prevStatus = res.status;
    if (prevStatus === nextStatus) return res;

    const canceledAt = nextStatus === 'Cancelada' ? new Date() : null;

    await this.dataSource.transaction(async (manager) => {
      const reservationsRepoTx = manager.getRepository(Reservation);
      const vehicleRepoTx = manager.getRepository(Vehicle);
      const refundsRepoTx = manager.getRepository(Refund);

      res.status = nextStatus;
      res.updatedAt = new Date();
      await reservationsRepoTx.save(res);

      if (nextStatus === 'Cancelada' || nextStatus === 'Vencida') {
        const v = await vehicleRepoTx.findOne({ where: { id: res.vehicle.id } });
        if (v) {
          v.status = 'available';
          await vehicleRepoTx.save(v);
        }
      }

      if (nextStatus === 'Vigente') {
        const v = await vehicleRepoTx.findOne({ where: { id: res.vehicle.id } });
        if (v) {
          v.status = 'reserved';
          await vehicleRepoTx.save(v);
        }
      }

      if (nextStatus === 'Cancelada') {
        const already = await refundsRepoTx.findOne({ where: { reservationId: res.id } });
        if (!already) {
          const refundAmount = await this.settings.getNumber('reservation.refundAmount', 750_000);

          const refund = refundsRepoTx.create({
            reservationId: res.id,
            clientDni: res.client?.dni ?? '-',
            plate: res.plate ?? res.vehicle?.plate ?? '-',
            vehicleLabel: res.vehicleLabel ?? '-',
            canceledAt: canceledAt ?? new Date(),
            status: RefundStatus.PENDING,
            expectedAmount: Number(refundAmount),
            paidAmount: null,
            deliveredAt: null,
            deliveredByUserId: null,
          } as Partial<Refund>);

          await refundsRepoTx.save(refund);
        }
      }
    });

    this.notify('updated', res.id);
    return res;
  }

  async expirePastReservations(): Promise<void> {
    const now = new Date();
    const allReservations = await this.reservationsRepo.find({
      relations: ['client', 'vehicle', 'guarantors'],
    });

    for (const reservation of allReservations) {
      if (!reservation.expiryDate) continue;
      if (['Vencida', 'Cancelada'].includes(reservation.status)) continue;

      if (now > reservation.expiryDate) {
        reservation.status = 'Vencida';
        reservation.updatedAt = new Date();
        await this.reservationsRepo.save(reservation);

        if (reservation.vehicle) {
          reservation.vehicle.status = 'available';
          await this.vehicleRepo.save(reservation.vehicle);
        }
      }
    }
  }

  async forceExpire(): Promise<{ expired: number }> {
    await this.expirePastReservations();
    return { expired: 1 };
  }

  async extendReservationsWithNewGuarantors(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const reservations = await this.reservationsRepo.find({ relations: ['guarantors'] });

    for (const reservation of reservations) {
      if (reservation.status !== 'Vigente') continue;

      const recentGuarantors = reservation.guarantors.filter(
        (g) => new Date(g.createdAt) > cutoff,
      );

      if (recentGuarantors.length > 0) {
        reservation.expiryDate = this.plusHours(new Date(reservation.expiryDate), 24);
        reservation.updatedAt = new Date();
        await this.reservationsRepo.save(reservation);
      }
    }
  }

  // ============================
  // ✅ GARANTES (Cloudinary URLs + legacy fs)
  // ============================

  async addGuarantor(
    reservationId: number,
    data: {
      firstName: string;
      lastName: string;
      dni: string;
      address?: string;
      phone?: string;
    },
    docs: { dniFilePath?: string | null; payslipFilePath?: string | null },
  ) {
    const reservation = await this.findOne(reservationId);
    if (!reservation) throw new NotFoundException('Reserva no encontrada');

    const guarantor = this.guarantorRepo.create({
      reservation: { id: reservation.id } as Reservation,
      firstName: data.firstName,
      lastName: data.lastName,
      dni: data.dni,
      address: data.address,
      phone: data.phone,
      dniFilePath: docs.dniFilePath ?? null,
      payslipFilePath: docs.payslipFilePath ?? null,
    });

    await this.guarantorRepo.save(guarantor);

    const updated = await this.findOne(reservation.id);
    updated.updatedAt = new Date();
    await this.reservationsRepo.save(updated);

    this.notify('updated', reservation.id);
    return updated;
  }

  async getGuarantorDocUrlIfAny(
    guarantorId: number,
    kind: GuarantorDocKind,
  ): Promise<string | null> {
    const g = await this.guarantorRepo.findOne({ where: { id: guarantorId } });
    if (!g) throw new NotFoundException('Garante no encontrado');

    const val = kind === 'dni' ? g.dniFilePath : g.payslipFilePath;
    if (!val) return null;

    // Cloudinary / URL
    if (/^https?:\/\//i.test(val)) return val;

    return null;
  }

  async getGuarantorDocPath(
    guarantorId: number,
    kind: GuarantorDocKind,
  ): Promise<{ absPath: string; filename: string }> {
    const g = await this.guarantorRepo.findOne({ where: { id: guarantorId } });
    if (!g) throw new NotFoundException('Garante no encontrado');

    const val = kind === 'dni' ? g.dniFilePath : g.payslipFilePath;
    if (!val) {
      throw new NotFoundException(
        kind === 'dni'
          ? 'DNI no encontrado para este garante'
          : 'Recibo de sueldo no encontrado para este garante',
      );
    }

    // Si es URL, este método no debería usarse
    if (/^https?:\/\//i.test(val)) {
      throw new BadRequestException('El archivo está en Cloudinary (use redirect).');
    }

    // legacy: guardado como "/uploads/guarantors/xxx.pdf"
    const cleaned = val.replace(/^\/+/, ''); // "uploads/..."
    const absPath = path.join(process.cwd(), cleaned);
    const filename = path.basename(absPath);

    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('Archivo no encontrado en el servidor');
    }

    return { absPath, filename };
  }

  // ============================
  // PDF generación (igual que lo tenías)
  // ============================

  async getPdf(id: number): Promise<Buffer> {
    const res = await this.reservationsRepo.findOne({
      where: { id },
      relations: ['client', 'vehicle', 'guarantors', 'seller'],
    });
    if (!res) throw new NotFoundException('Reserva no encontrada');

    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const lastName = res.client?.lastName || 'Cliente';
    const fileName = `Reserva-${lastName}-${dateString}-${res.id}.pdf`;

    const dir = path.join(__dirname, '../../uploads/reservations', String(res.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

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

    doc.fontSize(22).fillColor('#1e1e1e').text('GL Motors', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text('Comprobante de Reserva', { align: 'center' });
    doc.fontSize(10).fillColor('#777').text(`Emitido el ${this.nowString()}`, {
      align: 'center',
    });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
    doc.moveDown(1);

    const sectionTitle = (t: string) => {
      doc.moveDown(0.6);
      doc.fontSize(13).fillColor('#009879').text(t.toUpperCase(), { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#1e1e1e');
    };

    sectionTitle('Datos de la Reserva');
    doc.text(`Número: ${res.id}`);
    doc.text(`Estado: ${res.status}`);
    doc.text(`Importe de Reserva: ${pesos(Number(res.amount))}`);
    doc.text(`Fecha: ${new Date(res.date).toLocaleDateString('es-AR')}`);
    doc.text(`Vigencia hasta: ${this.formatDateTimeAR(new Date(res.expiryDate))}`);

    sectionTitle('Cliente');
    doc.text(`${res.client.firstName} ${res.client.lastName}`);
    doc.text(`DNI: ${res.client.dni}`);
    if ((res.client as any).phone) doc.text(`Teléfono: ${(res.client as any).phone}`);
    if ((res.client as any).address) doc.text(`Domicilio: ${(res.client as any).address}`);

    sectionTitle('Vehículo');
    doc.text(`${res.vehicleLabel}`);
    doc.text(`Patente: ${res.plate}`);
    if (res.vehicle?.color) doc.text(`Color: ${res.vehicle.color}`);
    if (res.vehicle?.year) doc.text(`Año: ${res.vehicle.year}`);

    if (res.seller) {
      sectionTitle('Vendedor');
      const seller = res.seller as any;
      const sellerFullName =
        `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim() ||
        seller.name ||
        seller.username ||
        '';
      if (sellerFullName) doc.text(sellerFullName);
    }

    doc.moveDown(1);
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(
        `Esta reserva tendrá vigencia hasta ${this.formatDateTimeAR(
          new Date(res.expiryDate),
        )}. En caso de no integrarse el saldo o no presentar la documentación de garantes, quedará sin efecto.`,
        { align: 'justify' },
      );

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();

    try {
      const logoPath = path.join(__dirname, '../../public/Logobyn.JPG');
      const footerY = doc.y + 5;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, footerY, { fit: [40, 40] });
      }
      doc.fontSize(8).fillColor('#777').text(
        'GL Motors · Dr. L. Chiesa 640 · Longchamps',
        110,
        footerY + 10,
        { align: 'left' },
      );
    } catch {
      doc.fontSize(8).fillColor('#777').text(
        'GL Motors · Dr. L. Chiesa 640 · Longchamps',
        { align: 'center' },
      );
    }

    doc.end();
    await done;

    const pdfBuffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, pdfBuffer);

    return pdfBuffer;
  }
}