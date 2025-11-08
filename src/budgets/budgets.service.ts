import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Budget } from './budget.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { BudgetReportsService } from '../budget-reports/budget-reports.service';
import { LoanRate } from '../loan-rates/loan-rate.entity';
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
    @InjectRepository(LoanRate)
    private readonly loanRatesRepository: Repository<LoanRate>,
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

    // 🧮 Buscar tasas según el tipo de préstamo y meses
    const prendarioRate = await this.loanRatesRepository.findOne({
      where: { type: 'prendario', months: dto.installments },
    });
    const personalRate = await this.loanRatesRepository.findOne({
      where: { type: 'personal', months: dto.installments },
    });
    const financiacionRate = await this.loanRatesRepository.findOne({
      where: { type: 'financiacion', months: dto.installments },
    });

    console.log('📊 Tasas aplicadas:', {
      prendarioRate: prendarioRate?.rate,
      personalRate: personalRate?.rate,
      financiacionRate: financiacionRate?.rate,
    });

    // 💰 Aplicar tasas si existen (monto final con interés simple agregado)
    const prendarioConInteres =
      dto.prendarioAmount != null
        ? dto.prendarioAmount * (1 + (prendarioRate?.rate || 0) / 100)
        : undefined;

    const personalConInteres =
      dto.personalAmount != null
        ? dto.personalAmount * (1 + (personalRate?.rate || 0) / 100)
        : undefined;

    const financiacionConInteres =
      dto.financiacionAmount != null
        ? dto.financiacionAmount * (1 + (financiacionRate?.rate || 0) / 100)
        : undefined;

    // 🔹 Calcular total final con intereses
    const finalPrice =
      (dto.downPayment || 0) +
      (dto.tradeInValue || 0) +
      (prendarioConInteres || 0) +
      (personalConInteres || 0) +
      (financiacionConInteres || 0);

    // 💵 Calcular valor de cuota total (suma de montos financiados / cuotas)
    const totalPrestamos =
      (prendarioConInteres || 0) +
      (personalConInteres || 0) +
      (financiacionConInteres || 0);

    const installments: number = dto.installments || 0;
    const installmentValue =
      installments > 0 && totalPrestamos > 0 ? totalPrestamos / installments : undefined;

    // 🧾 Crear el presupuesto correctamente tipado
    const budgetBase: DeepPartial<Budget> = {
      vehicle,
      client,
      price: dto.price,
      status: dto.status ?? 'pending',
      paymentType: dto.paymentType ?? null,
      installments,
      finalPrice,
      installmentValue, // si no aplica, queda undefined (OK para DeepPartial)
      // Campos opcionales: si no hay valor, los omitimos (no usamos null)
      downPayment: dto.downPayment ?? undefined,
      tradeInValue: dto.tradeInValue ?? undefined,
      prendarioMonths: dto.prendarioMonths ?? undefined,
      personalMonths: dto.personalMonths ?? undefined,
      financiacionMonths: dto.financiacionMonths ?? undefined,
    };

    // Agregar condicionalmente tasas y montos (solo si existen)
    if (prendarioRate?.rate != null) budgetBase.prendarioRate = prendarioRate.rate;
    if (personalRate?.rate != null) budgetBase.personalRate = personalRate.rate;
    if (financiacionRate?.rate != null) budgetBase.financiacionRate = financiacionRate.rate;

    if (prendarioConInteres != null) budgetBase.prendarioAmount = prendarioConInteres;
    if (personalConInteres != null) budgetBase.personalAmount = personalConInteres;
    if (financiacionConInteres != null) budgetBase.financiacionAmount = financiacionConInteres;

    const created = this.budgetsRepository.create(budgetBase);
    const savedBudget: Budget = await this.budgetsRepository.save(created);

    // 📊 Registrar en budget-reports (installmentValue como número; si no hay, 0)
    try {
      await this.budgetReportsService.create({
        budgetId: savedBudget.id,
        vehicleId: dto.vehicleId,
        clientId: dto.clientId,
        sellerId: dto.sellerId,
        paymentType: dto.paymentType,
        listPrice: dto.price,
        finalPrice,
        installments,
        installmentValue: installmentValue ?? 0,
        downPayment: dto.downPayment,
        status: dto.status,
      });
      console.log(`✅ Reporte creado con tasas para budget ${savedBudget.id}`);
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

// ✅ Generar PDF con formato limpio, montos netos y sin “Precio Final”
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

  try {
    const logoPath = path.join(__dirname, '../../logos/Logobyn.JPG');
    if (fs.existsSync(logoPath)) {
      doc.opacity(0.07).image(logoPath, 100, 180, { fit: [400, 400], align: 'center' });
      doc.opacity(1);
    }
  } catch {
    console.warn('⚠️ No se pudo cargar el logo de marca de agua');
  }

  doc.fontSize(22).fillColor('#1e1e1e').text('DE GRAZIA AUTOMOTORES', { align: 'center' });
  doc.fontSize(12).fillColor('#555').text('Presupuesto de Vehículo', { align: 'center' });
  doc.fontSize(10).fillColor('#777').text(`Emitido el ${this.nowString()}`, { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
  doc.moveDown(1);

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

  const formatCuota = (monto: number | null | undefined, cuotas: number | null | undefined) => {
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
  if (budget.downPayment != null) doc.text(`Anticipo: ${formatPesos(budget.downPayment)}`);
  if (budget.tradeInValue != null) doc.text(`Valor de Permuta: ${formatPesos(budget.tradeInValue)}`);
  if (budget.price != null) doc.text(`Precio Lista: ${formatPesos(budget.price)}`);
  if (budget.installmentValue != null)
    doc.text(`Valor de Cuota Total: ${formatPesos(budget.installmentValue)}`);

  // 💰 Detalle de préstamos
  const hasLoans =
    !!budget.prendarioAmount || !!budget.personalAmount || !!budget.financiacionAmount;

  if (hasLoans) {
    sectionTitle('Detalle de Préstamos y Financiaciones');

    // Para mostrar el monto neto (sin interés)
    const calcNeto = (montoConInteres?: number | null, tasa?: number | null) => {
      if (!montoConInteres || !tasa) return montoConInteres || 0;
      return montoConInteres / (1 + tasa / 100);
    };

    if (budget.prendarioAmount != null) {
      const neto = calcNeto(budget.prendarioAmount, budget.prendarioRate);
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#009879').text('Préstamo Prendario');
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`Monto (neto): ${formatPesos(neto)}`)
        .text(`Tasa aplicada: ${budget.prendarioRate ?? 0}%`)
        .text(`Cuotas: ${budget.prendarioMonths ?? '-'}`)
        .text(`Valor de cada cuota: ${formatCuota(budget.prendarioAmount, budget.prendarioMonths)}`);
    }

    if (budget.personalAmount != null) {
      const neto = calcNeto(budget.personalAmount, budget.personalRate);
      doc.moveDown(0.8);
      doc.fontSize(12).fillColor('#009879').text('Préstamo Personal');
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`Monto (neto): ${formatPesos(neto)}`)
        .text(`Tasa aplicada: ${budget.personalRate ?? 0}%`)
        .text(`Cuotas: ${budget.personalMonths ?? '-'}`)
        .text(`Valor de cada cuota: ${formatCuota(budget.personalAmount, budget.personalMonths)}`);
    }

    if (budget.financiacionAmount != null) {
      const neto = calcNeto(budget.financiacionAmount, budget.financiacionRate);
      doc.moveDown(0.8);
      doc.fontSize(12).fillColor('#009879').text('Financiación Personal');
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`Monto (neto): ${formatPesos(neto)}`)
        .text(`Tasa aplicada: ${budget.financiacionRate ?? 0}%`)
        .text(`Cuotas: ${budget.financiacionMonths ?? '-'}`)
        .text(
          `Valor de cada cuota: ${formatCuota(
            budget.financiacionAmount,
            budget.financiacionMonths,
          )}`,
        );
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
    doc.text(`${budget.vehicle.brand} ${budget.vehicle.model} ${budget.vehicle.versionName || ''}`);
    if (budget.vehicle.year) doc.text(`Año: ${budget.vehicle.year}`);
    if (budget.vehicle.color) doc.text(`Color: ${budget.vehicle.color}`);
    if (budget.vehicle.plate) doc.text(`Patente: ${budget.vehicle.plate}`);
  }

  // ⚖️ Condiciones legales
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(1);
  doc.fontSize(13).fillColor('#009879').text('CONDICIONES LEGALES Y COMERCIALES', { underline: true });
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
