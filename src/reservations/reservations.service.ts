import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './reservation.entity';
import { Guarantor } from './guarantor.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);

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
  ) {}

  private getDefaultAmount(): number {
    return 500000;
  }

  private plusHours(d: Date, hours: number) {
    return new Date(d.getTime() + hours * 60 * 60 * 1000);
  }

  private nowString(): string {
    return new Date().toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async findAll() {
    const list = await this.reservationsRepo.find({
      relations: ['client', 'vehicle', 'guarantors'],
      order: { id: 'DESC' },
    });

    return list.map((r) => ({
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
    }));
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
    if (dto.clientId) client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    else if (dto.clientDni)
      client = await this.clientRepo.findOne({ where: { dni: dto.clientDni } });

    if (!client) throw new BadRequestException('Cliente no encontrado por DNI/ID');

    const vehicle = await this.vehicleRepo.findOne({ where: { plate: dto.plate } });
    if (!vehicle) throw new BadRequestException('Vehículo no encontrado');
    if (vehicle.sold) throw new BadRequestException('El vehículo está vendido');
    if (vehicle.status?.toLowerCase() === 'reserved')
      throw new BadRequestException('El vehículo ya está reservado');

    const sellerEntity = dto.sellerId
      ? ((await this.userRepo.findOne({ where: { id: dto.sellerId } })) as any)
      : undefined;

    const date = dto.date ? new Date(dto.date) : new Date();
    const expiry = this.plusHours(date, 48);

    const reservation = this.reservationsRepo.create({
      client,
      vehicle,
      seller: sellerEntity,
      amount: Number(dto.amount ?? this.getDefaultAmount()),
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

    return saved;
  }

  async update(id: number, dto: { status?: Reservation['status'] }) {
    const res = await this.findOne(id);
    if (dto.status) {
      res.status = dto.status;
      res.updatedAt = new Date();
      await this.reservationsRepo.save(res);
      if (dto.status === 'Cancelada') {
        const v = await this.vehicleRepo.findOne({ where: { id: res.vehicle.id } });
        if (v) {
          v.status = 'available';
          await this.vehicleRepo.save(v);
        }
      }
    }
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
        console.log(
          `[${this.nowString()}] ⚠️ Reserva #${reservation.id} marcada como Vencida automáticamente.`,
        );
      }
    }
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
        console.log(
          `[${this.nowString()}] 🔄 Reserva #${reservation.id} extendida automáticamente por nuevos garantes.`,
        );
      }
    }
  }

  async addGuarantor(
    reservationId: number,
    data: { firstName: string; lastName: string; dni: string; address?: string; phone?: string },
    files: { dniFile?: Express.Multer.File[]; payslipFile?: Express.Multer.File[] },
  ) {
    const reservation = await this.findOne(reservationId);
    if (!reservation) throw new NotFoundException('Reserva no encontrada');

    const uploadDir = path.join(__dirname, '../../uploads/guarantors');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let dniFilePath: string | null = null;
    let payslipFilePath: string | null = null;

    const dniFile = files?.dniFile?.[0];
    const payslipFile = files?.payslipFile?.[0];

    if (dniFile) {
      const fileName = `dni_${Date.now()}_${dniFile.originalname}`;
      const fullPath = path.join(uploadDir, fileName);
      fs.writeFileSync(fullPath, dniFile.buffer);
      dniFilePath = `/uploads/guarantors/${fileName}`;
    }

    if (payslipFile) {
      const fileName = `payslip_${Date.now()}_${payslipFile.originalname}`;
      const fullPath = path.join(uploadDir, fileName);
      fs.writeFileSync(fullPath, payslipFile.buffer);
      payslipFilePath = `/uploads/guarantors/${fileName}`;
    }

    const guarantor = this.guarantorRepo.create({
      reservation: { id: reservation.id } as Reservation,
      firstName: data.firstName,
      lastName: data.lastName,
      dni: data.dni,
      address: data.address,
      phone: data.phone,
      dniFilePath,
      payslipFilePath,
    });

    await this.guarantorRepo.save(guarantor);

    const updated = await this.findOne(reservation.id);
    updated.updatedAt = new Date();
    await this.reservationsRepo.save(updated);

    return updated;
  }

// ✅ getPdf final: diseño profesional completo, sin caracteres raros ni espaciados extra
async getPdf(id: number): Promise<Buffer> {
  const res = await this.reservationsRepo.findOne({
    where: { id },
    relations: ['client', 'vehicle', 'guarantors', 'seller'],
  });
  if (!res) throw new NotFoundException('Reserva no encontrada');

  const dir = path.join(__dirname, '../../uploads/reservations', String(res.id));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `reserva_${res.id}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  // 🖼️ Marca de agua (logo grande y translúcido)
  try {
    const logoPath = path.join(__dirname, '../../logos/Logobyn.JPG');
    if (fs.existsSync(logoPath)) {
      doc.opacity(0.07).image(logoPath, 100, 180, { fit: [400, 400], align: 'center' });
      doc.opacity(1);
    }
  } catch (err) {
    console.warn('⚠️ No se pudo cargar el logo de marca de agua:', err);
  }

  // 🧾 Encabezado
  doc
    .fontSize(22)
    .fillColor('#1e1e1e')
    .text('DE GRAZIA AUTOMOTORES', { align: 'center' });
  doc
    .fontSize(12)
    .fillColor('#555')
    .text('Comprobante de Reserva', { align: 'center' });
  doc
    .fontSize(10)
    .fillColor('#777')
    .text(`Emitido el ${this.nowString()}`, { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
  doc.moveDown(1);

  // 🔹 Función auxiliar de título
  const sectionTitle = (t: string) => {
    doc.moveDown(0.6);
    doc.fontSize(13).fillColor('#009879').text(t.toUpperCase(), { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#1e1e1e');
  };

  // 📋 Datos de la reserva
  sectionTitle('Datos de la Reserva');
  doc.text(`Número: ${res.id}`);
  doc.text(`Estado: ${res.status}`);
  doc.text(`Importe de Reserva: ${pesos(Number(res.amount))}`);
  doc.text(`Fecha: ${new Date(res.date).toLocaleDateString('es-AR')}`);
  doc.text(`Vigencia hasta: ${new Date(res.expiryDate).toLocaleString('es-AR')}`);

  // 👤 Cliente
  sectionTitle('Cliente');
  doc.text(`${res.client.firstName} ${res.client.lastName}`);
  doc.text(`DNI: ${res.client.dni}`);
  if (res.client.phone) doc.text(`Teléfono: ${res.client.phone}`);
  if (res.client.address) doc.text(`Domicilio: ${res.client.address}`);

  // 🚗 Vehículo
  sectionTitle('Vehículo');
  doc.text(`${res.vehicleLabel}`);
  doc.text(`Patente: ${res.plate}`);
  if (res.vehicle?.color) doc.text(`Color: ${res.vehicle.color}`);
  if (res.vehicle?.year) doc.text(`Año: ${res.vehicle.year}`);

  // 🧑‍💼 Vendedor
  if (res.seller) {
    sectionTitle('Vendedor');
    const seller = res.seller as any;
    // 🔧 corregido espaciado: sin salto de línea adicional
    doc.text(`${seller.firstName ?? ''} ${seller.lastName ?? ''}`);
    if (seller.email) doc.text(`Email: ${seller.email}`);
    if (seller.phone) doc.text(`Teléfono: ${seller.phone}`);
  }



  // 🧠 Nota final
  doc.moveDown(1);
  doc
    .fontSize(9)
    .fillColor('#555')
    .text(
      `Esta reserva tendrá vigencia hasta ${new Date(res.expiryDate).toLocaleString(
        'es-AR',
      )}. En caso de no integrarse el saldo o no presentar la documentación de garantes, quedará sin efecto.`,
      { align: 'justify' },
    );

  // 📍 Pie de página institucional con logo y texto
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();

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
  } catch (err) {
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
}
