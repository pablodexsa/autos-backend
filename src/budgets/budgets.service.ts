import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './budget.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { BudgetReportsService } from '../budget-reports/budget-reports.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetsRepository: Repository<Budget>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    private readonly budgetReportsService: BudgetReportsService,
  ) {}

  private pesos(n: number | null | undefined) {
    if (!n && n !== 0) return '-';
    return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  }

  private nowString(): string {
    return new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async findAll() {
    return this.budgetsRepository.find({
      relations: ['vehicle', 'client'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const budget = await this.budgetsRepository.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });
    if (!budget) throw new NotFoundException('Presupuesto no encontrado');
    return budget;
  }

  async create(dto: any) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id: dto.vehicleId, sold: false },
    });
    if (!vehicle) throw new BadRequestException('Vehículo no disponible');

    const client = await this.clientsRepository.findOne({
      where: { id: dto.clientId },
    });
    if (!client) throw new BadRequestException('Cliente no encontrado');

    const budget = this.budgetsRepository.create({
      vehicle,
      client,
      price: dto.price,
      status: dto.status ?? 'pending',
      paymentType: dto.paymentType ?? null,
      installments: dto.installments ?? null,
      finalPrice: dto.finalPrice ?? null,
      installmentValue: dto.installmentValue ?? null,
      downPayment: dto.downPayment ?? null,
      tradeInValue: dto.tradeInValue ?? null,
      prendarioRate: dto.prendarioRate ?? null,
      prendarioMonths: dto.prendarioMonths ?? null,
      prendarioAmount: dto.prendarioAmount ?? null,
      personalRate: dto.personalRate ?? null,
      personalMonths: dto.personalMonths ?? null,
      personalAmount: dto.personalAmount ?? null,
      financiacionRate: dto.financiacionRate ?? null,
      financiacionMonths: dto.financiacionMonths ?? null,
      financiacionAmount: dto.financiacionAmount ?? null,
    });

    const savedBudget = await this.budgetsRepository.save(budget);

    // 🧾 Registrar también en budget-reports
    try {
      await this.budgetReportsService.create({
        budgetId: savedBudget.id,
        vehicleId: dto.vehicleId,
        clientId: dto.clientId,
        sellerId: dto.sellerId,
        paymentType: dto.paymentType,
        listPrice: dto.price,
        finalPrice: dto.finalPrice,
        installments: dto.installments,
        installmentValue: dto.installmentValue,
        downPayment: dto.downPayment,
        status: dto.status,
      });

      console.log(`✅ Reporte de presupuesto creado para budget ${savedBudget.id}`);
    } catch (err) {
      console.error('⚠️ No se pudo crear el registro en budget-reports:', err);
    }

    return savedBudget;
  }

  async update(id: number, dto: any) {
    const budget = await this.findOne(id);
    Object.assign(budget, dto);
    return this.budgetsRepository.save(budget);
  }

  async remove(id: number) {
    const budget = await this.findOne(id);
    return this.budgetsRepository.remove(budget);
  }

// ✅ Generar PDF limpio sin cuadro ni total financiado
async getPdf(id: number): Promise<Buffer> {
  const budget = await this.findOne(id);

  const dir = path.join(__dirname, '../../uploads/budgets', String(budget.id));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `presupuesto_${budget.id}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  // 🖼️ Marca de agua
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
  doc
    .fontSize(22)
    .fillColor('#1e1e1e')
    .text('DE GRAZIA AUTOMOTORES', { align: 'center' });
  doc.fontSize(12).fillColor('#555').text('Presupuesto de Vehículo', { align: 'center' });
  doc
    .fontSize(10)
    .fillColor('#777')
    .text(`Emitido el ${this.nowString()}`, { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
  doc.moveDown(1);

  const sectionTitle = (t: string) => {
    doc.moveDown(0.6);
    doc.fontSize(13).fillColor('#009879').text(t.toUpperCase(), { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#1e1e1e');
  };

  const formatCuota = (monto: number | null, cuotas: number | null) => {
    if (!monto || !cuotas) return '-';
    const valor = monto / cuotas;
    return `$ ${valor.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 📋 Datos del presupuesto
  sectionTitle('Datos del Presupuesto');
  doc.text(`Número: ${budget.id}`);
  doc.text(`Fecha: ${new Date(budget.createdAt).toLocaleDateString('es-AR')}`);
  doc.text(`Forma de Pago: ${budget.paymentType || '-'}`);
  if (budget.installments) doc.text(`Cantidad de Cuotas Totales: ${budget.installments}`);

  // 💸 Montos principales
  sectionTitle('Detalle de Montos');
  if (budget.downPayment) doc.text(`Anticipo: ${this.pesos(budget.downPayment)}`);
  if (budget.tradeInValue) doc.text(`Valor de Permuta: ${this.pesos(budget.tradeInValue)}`);
  if (budget.price) doc.text(`Precio Lista: ${this.pesos(budget.price)}`);
  if (budget.finalPrice) doc.text(`Precio Final: ${this.pesos(budget.finalPrice)}`);
  if (budget.installmentValue)
    doc.text(`Valor de Cuota Total: ${this.pesos(budget.installmentValue)}`);

  // 💰 Detalle de préstamos
  const hasLoans =
    budget.prendarioAmount || budget.personalAmount || budget.financiacionAmount;

  if (hasLoans) {
    sectionTitle('Detalle de Préstamos y Financiaciones');

    if (budget.prendarioAmount) {
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#009879')
        .text('Préstamo Prendario');
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`Monto: ${this.pesos(budget.prendarioAmount)}`)
        .text(`Cuotas: ${budget.prendarioMonths || '-'}`)
        .text(`Valor de cada cuota: ${formatCuota(budget.prendarioAmount, budget.prendarioMonths)}`);
    }

    if (budget.personalAmount) {
      doc.moveDown(0.8);
      doc
        .fontSize(12)
        .fillColor('#009879')
        .text('Préstamo Personal');
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`Monto: ${this.pesos(budget.personalAmount)}`)
        .text(`Cuotas: ${budget.personalMonths || '-'}`)
        .text(`Valor de cada cuota: ${formatCuota(budget.personalAmount, budget.personalMonths)}`);
    }

    if (budget.financiacionAmount) {
      doc.moveDown(0.8);
      doc
        .fontSize(12)
        .fillColor('#009879')
        .text('Financiación Personal');
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`Monto: ${this.pesos(budget.financiacionAmount)}`)
        .text(`Cuotas: ${budget.financiacionMonths || '-'}`)
        .text(`Valor de cada cuota: ${formatCuota(budget.financiacionAmount, budget.financiacionMonths)}`);
    }
  }

  // 👤 Cliente
  if (budget.client) {
    sectionTitle('Cliente');
    doc.text(`${budget.client.firstName} ${budget.client.lastName}`);
    doc.text(`DNI: ${budget.client.dni}`);
    if (budget.client.phone) doc.text(`Teléfono: ${budget.client.phone}`);
    if (budget.client.address) doc.text(`Domicilio: ${budget.client.address}`);
  }

  // 🚗 Vehículo
  if (budget.vehicle) {
    sectionTitle('Vehículo');
    doc.text(
      `${budget.vehicle.brand} ${budget.vehicle.model} ${budget.vehicle.versionName || ''}`,
    );
    if (budget.vehicle.year) doc.text(`Año: ${budget.vehicle.year}`);
    if (budget.vehicle.color) doc.text(`Color: ${budget.vehicle.color}`);
    if (budget.vehicle.plate) doc.text(`Patente: ${budget.vehicle.plate}`);
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
1. El presente documento no implica oferta irrevocable ni contrato, sino un presupuesto estimativo sujeto a disponibilidad del vehículo y aprobación crediticia. 
2. La cotización tiene una vigencia de 48 horas. 
3. Las tasas e importes indicados son orientativos y podrán modificarse según evaluación crediticia.
`;
  doc.fontSize(8.5).fillColor('#555').text(legales, { align: 'justify', lineGap: 2.5 });

  doc.end();
  await done;
  const pdfBuffer = Buffer.concat(chunks);
  fs.writeFileSync(filePath, pdfBuffer);
  return pdfBuffer;
}

}
