import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Sale } from './sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Installment } from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';
import PDFDocument from 'pdfkit'; // ✅ Import corregido
import * as fs from 'fs';
import * as path from 'path';

function pmnt(p: number, r: number, n: number) {
  // Fórmula de amortización (cuota fija)
  if (r === 0) return p / n;
  return (p * r) / (1 - Math.pow(1 + r, -n));
}

function yyyymmToDate(yyyymm: string, day: number): Date {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale) private readonly salesRepo: Repository<Sale>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Reservation) private readonly resRepo: Repository<Reservation>,
    @InjectRepository(Installment) private readonly instRepo: Repository<Installment>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  // 🔍 Vehículos disponibles o reservados por DNI
  async eligibleVehiclesForDni(dni?: string) {
    const available = await this.vehicleRepo.find({
      where: { status: In(['Available', 'available']) },
    });

    if (!dni) return available;

    // Buscar reservas aceptadas por cliente
    const acceptedRes = await this.resRepo.find({
      where: {
        client: { dni },
        status: In(['Accepted', 'accepted']),
      },
      relations: ['vehicle', 'client'],
    });

    const reservedVehicles = acceptedRes.map((r) => r.vehicle).filter(Boolean);
    const map = new Map<number, Vehicle>();
    for (const v of [...available, ...reservedVehicles]) map.set(v.id, v);
    return Array.from(map.values());
  }

  // 🧾 Crear nueva venta
  async create(dto: CreateSaleDto) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const client = await this.clientRepo.findOne({ where: { dni: dto.clientDni } });

    const sale = this.salesRepo.create({
      ...dto,
      client: client ?? undefined,
      paymentComposition: {
        hasAdvance: (dto.downPayment ?? 0) > 0,
        hasPrendario: (dto.prendarioAmount ?? 0) > 0 && (dto.prendarioInstallments ?? 0) > 0,
        hasPersonal: (dto.personalAmount ?? 0) > 0 && (dto.personalInstallments ?? 0) > 0,
        hasFinancing: (dto.inHouseAmount ?? 0) > 0 && (dto.inHouseInstallments ?? 0) > 0,
      },
    });

    const saved = await this.salesRepo.save(sale);
    vehicle.status = 'Sold';
    await this.vehicleRepo.save(vehicle);

// 💳 Generar plan de pagos (financiación interna)
const inHouseAmount = dto.inHouseAmount ?? 0;
const inHouseInstallments = dto.inHouseInstallments ?? 0;
const inHouseRate = dto.inHouseMonthlyRate ?? 0; // hoy viene 0

if (inHouseAmount > 0 && inHouseInstallments > 0) {
  // Si la tasa es 0 → monto / cuotas
  const installmentValue = parseFloat(
    pmnt(inHouseAmount, inHouseRate, inHouseInstallments).toFixed(2),
  );

  const baseDate = yyyymmToDate(dto.initialPaymentMonth, dto.paymentDay);

  for (let i = 0; i < inHouseInstallments; i++) {
    const due = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + i,
      dto.paymentDay,
      12,
      0,
      0,
    );

    const inst = this.instRepo.create({
      sale: saved,                               // Relación CORRECTA
      saleId: saved.id,
      client: client ?? null,                    // Cliente asociado
      concept: 'PERSONAL_FINANCING',             // Mantengo tu concepto
      amount: installmentValue,
      dueDate: due,
      paid: false,
      status: 'PENDING',
    } as Partial<Installment>);

    await this.instRepo.save(inst);
  }
}

    return saved;
  }

  // 📋 Listar todas las ventas
  async findAll() {
    return this.salesRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['vehicle', 'client'],
    });
  }

  // 🔎 Buscar una venta
  async findOne(id: number) {
    const sale = await this.salesRepo.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  // 🖨️ Generar comprobante de venta profesional
  async getPdf(id: number): Promise<Buffer> {
    const sale = await this.findOne(id);

    const dir = path.join(__dirname, '../../uploads/sales', String(sale.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `venta_${sale.id}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    try {
      const logoPath = path.join(__dirname, '../../logos/Logobyn.JPG');
      if (fs.existsSync(logoPath)) {
        doc.opacity(0.07).image(logoPath, 100, 180, { fit: [400, 400], align: 'center' });
        doc.opacity(1);
      }
    } catch {
      console.warn('⚠️ No se pudo cargar el logo de marca de agua');
    }

    // 🏷️ Encabezado
    doc.fontSize(22).fillColor('#1e1e1e').text('DE GRAZIA AUTOMOTORES', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text('Comprobante de Venta', { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#777')
      .text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
    doc.moveDown(1);

    // Helpers
    const sectionTitle = (t: string) => {
      doc.moveDown(0.6);
      doc.fontSize(13).fillColor('#009879').text(t.toUpperCase(), { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#1e1e1e');
    };

    const formatPesos = (valor?: number | null): string => {
      if (valor == null) return '-';
      return `$ ${valor.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    // 📋 Datos de la venta
    sectionTitle('Datos de la Venta');
    doc.text(`Número: ${sale.id}`);
    doc.text(`Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-AR')}`);
    doc.text(`Forma de Pago: ${this.labelPayment(sale.paymentComposition) || '-'}`);
    if (sale.personalInstallments)
      doc.text(`Cantidad de Cuotas Totales: ${sale.personalInstallments}`);
    doc.text(`Día de Pago: ${sale.paymentDay}`);
    doc.text(`Mes Inicial de Pago: ${sale.initialPaymentMonth}`);

    // 💸 Montos principales
    sectionTitle('Detalle de Montos');
    if (sale.downPayment != null) doc.text(`Anticipo: ${formatPesos(sale.downPayment)}`);
    if (sale.tradeInValue != null) doc.text(`Valor de Permuta: ${formatPesos(sale.tradeInValue)}`);
    if (sale.basePrice != null) doc.text(`Precio Lista: ${formatPesos(sale.basePrice)}`);
    if (sale.balance != null) doc.text(`Saldo (vehículo - permuta): ${formatPesos(sale.balance)}`);
    if (sale.finalPrice != null) doc.text(`Precio Final de Venta: ${formatPesos(sale.finalPrice)}`);

    // 💰 Detalle de préstamos y financiaciones
    const hasLoans =
      !!sale.prendarioAmount || !!sale.personalAmount || !!sale.inHouseAmount;

    if (hasLoans) {
      sectionTitle('Detalle de Préstamos y Financiaciones');

      if (sale.prendarioAmount && sale.prendarioAmount > 0) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Préstamo Prendario');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Monto (neto): ${formatPesos(sale.prendarioAmount)}`);
        doc.text(`Cuotas: ${sale.prendarioInstallments ?? '-'}`);
      }

      if (sale.personalAmount && sale.personalAmount > 0) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Préstamo Personal');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Monto (neto): ${formatPesos(sale.personalAmount)}`);
        doc.text(`Cuotas: ${sale.personalInstallments ?? '-'}`);
      }

      if (sale.inHouseAmount && sale.inHouseAmount > 0) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Financiación Personal');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Monto (neto): ${formatPesos(sale.inHouseAmount)}`);
        doc.text(`Cuotas: ${sale.inHouseInstallments ?? '-'}`);
      }

      if (
        sale.paymentComposition?.hasFinancing &&
        sale.inHouseAmount > 0 &&
        sale.inHouseInstallments > 0
      ) {
        doc.moveDown(0.8);
        doc.fontSize(12).fillColor('#009879').text('Detalle de Cuotas Financiación Personal');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Cantidad de Cuotas: ${sale.inHouseInstallments}`);
        const valorCuota = sale.inHouseAmount / sale.inHouseInstallments;
        doc.text(`Valor de cada cuota: ${formatPesos(valorCuota)}`);
      }
    }

    // 👤 Cliente
    sectionTitle('Cliente');
    doc.text(`Nombre: ${sale.clientName}`);
    doc.text(`DNI: ${sale.clientDni}`);

    // 🚗 Vehículo
    if (sale.vehicle) {
      sectionTitle('Vehículo');
      doc.text(`${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.versionName || ''}`);
      if (sale.vehicle.year) doc.text(`Año: ${sale.vehicle.year}`);
      if (sale.vehicle.color) doc.text(`Color: ${sale.vehicle.color}`);
      if (sale.vehicle.plate) doc.text(`Patente: ${sale.vehicle.plate}`);
    }

    // ⚖️ Condiciones legales
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(1);
    doc
      .fontSize(13)
      .fillColor('#009879')
      .text('CONDICIONES LEGALES Y COMERCIALES', { underline: true });
    doc.moveDown(0.5);
    const legales = `
1. El presente comprobante acredita la venta del vehículo según condiciones pactadas.
2. La financiación personal, en caso de corresponder, se ajustará al plan seleccionado.
3. Las condiciones de entrega, plazos y documentación complementaria serán notificadas al cliente.
`;
    doc.fontSize(8.5).fillColor('#555').text(legales, { align: 'justify', lineGap: 2.5 });

    doc.end();
    await done;
    const pdfBuffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, pdfBuffer);
    return pdfBuffer;
  }

  private labelPayment(comp?: any): string {
    if (!comp) return '-';
    if (comp.hasFinancing) return 'Anticipo + Prendario + Personal + Financiación';
    if (comp.hasPersonal) return 'Anticipo + Prendario + Personal';
    if (comp.hasPrendario) return 'Anticipo + Préstamo Prendario';
    return 'Contado';
  }
}
