import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Sale } from './sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Installment } from '../installments/installment.entity';
import {
  InstallmentReceiver,
  InstallmentStatus,
} from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';
import { LoanRate } from '../loan-rates/loan-rate.entity';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';

function yyyymmToDate(yyyymm: string, day: number): Date {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
}

type MotoPlanConfig = {
  code: string;
  name: string;
  installments: number;
  downPayment?: number;
  totalInstallments?: number;
  firstInstallmentsCount?: number;
  firstInstallmentAmount?: number;
  remainingInstallmentAmount?: number;
};

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale) private readonly salesRepo: Repository<Sale>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Reservation)
    private readonly resRepo: Repository<Reservation>,
    @InjectRepository(Installment)
    private readonly instRepo: Repository<Installment>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(LoanRate)
    private readonly loanRateRepo: Repository<LoanRate>,
    private readonly mailService: MailService,
    private readonly settingsService: SettingsService,
  ) {}

  // 🔐 Helper: categorías permitidas según permisos del usuario (legacy + scoped)
  private getAllowedCategories(user: any): ('CAR' | 'MOTORCYCLE')[] {
    const perms: string[] = user?.permissions || [];

    const canCar =
      perms.includes('VEHICLE_READ') ||
      perms.includes('VEHICLE_READ_CAR') ||
      perms.includes('VEHICLE_CREATE') ||
      perms.includes('VEHICLE_CREATE_CAR');

    const canMoto =
      perms.includes('VEHICLE_READ') ||
      perms.includes('VEHICLE_READ_MOTORCYCLE') ||
      perms.includes('VEHICLE_CREATE') ||
      perms.includes('VEHICLE_CREATE_MOTORCYCLE');

    const out: ('CAR' | 'MOTORCYCLE')[] = [];
    if (canCar) out.push('CAR');
    if (canMoto) out.push('MOTORCYCLE');
    return out;
  }

  private assertCanAccessVehicleCategory(user: any, category: any) {
    const normalized: 'CAR' | 'MOTORCYCLE' = (category || 'CAR') as any;
    const allowed = this.getAllowedCategories(user);

    if (!allowed.length) {
      throw new ForbiddenException('No tenés permisos para acceder a ventas.');
    }

    if (!allowed.includes(normalized)) {
      throw new ForbiddenException(
        'No tenés permiso para operar con este tipo de vehículo',
      );
    }
  }

  // 🔍 Vehículos disponibles o reservados por DNI (FILTRADO por categoría)
  async eligibleVehiclesForDni(user: any, dni?: string) {
    const allowed = this.getAllowedCategories(user);
    if (!allowed.length) {
      throw new ForbiddenException(
        'No tenés permisos para acceder a vehículos.',
      );
    }

    const availableAll = await this.vehicleRepo.find({
      where: { status: In(['Available', 'available']) },
    });

    const available = availableAll.filter((v: any) =>
      allowed.includes(((v as any).category || 'CAR') as any),
    );

    if (!dni) return available;

    const acceptedRes = await this.resRepo.find({
      where: {
        client: { dni },
        status: In(['Accepted', 'accepted', 'Aceptada', 'aceptada']),
      },
      relations: ['vehicle', 'client'],
    });

    const reservedVehiclesAll = acceptedRes.map((r) => r.vehicle).filter(Boolean);
    const reservedVehicles = reservedVehiclesAll.filter((v: any) =>
      allowed.includes(((v as any).category || 'CAR') as any),
    );

    const map = new Map<number, Vehicle>();
    for (const v of [...available, ...reservedVehicles]) map.set(v.id, v);
    return Array.from(map.values());
  }

  // 🏍️ Lee planes de motos desde settings
  private async getMotoPlans(): Promise<MotoPlanConfig[]> {
    const raw = await this.settingsService.get('moto.plans');
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // 🏍️ Busca un plan puntual por código
  private async getMotoPlanConfig(
    code?: string | null,
  ): Promise<MotoPlanConfig | null> {
    if (!code) return null;

    const plans = await this.getMotoPlans();
    const plan = plans.find((p) => String(p.code) === String(code));

    return plan ?? null;
  }

  // 🏍️ Genera cuotas del plan motos
  private async createMotoPlanInstallments(
    sale: Sale,
    client: Client,
    dto: CreateSaleDto,
    plan: MotoPlanConfig,
  ) {
    const paymentDay = Number(dto.paymentDay);
    if (!paymentDay || !dto.initialPaymentMonth) {
      throw new BadRequestException(
        'Plan motos requiere paymentDay e initialPaymentMonth.',
      );
    }

    const baseDate = yyyymmToDate(dto.initialPaymentMonth, paymentDay);

    const downPayment = Number(plan.downPayment ?? 0);
    const totalInstallments = Number(
      plan.totalInstallments ?? plan.installments ?? 0,
    );
    const firstInstallmentsCount = Number(plan.firstInstallmentsCount ?? 0);
    const firstInstallmentAmount = Number(plan.firstInstallmentAmount ?? 0);
    const remainingInstallmentAmount = Number(
      plan.remainingInstallmentAmount ?? 0,
    );

    if (totalInstallments <= 0) {
      throw new BadRequestException(
        `El plan ${plan.name} no tiene cuotas válidas configuradas.`,
      );
    }

    if (firstInstallmentsCount > totalInstallments) {
      throw new BadRequestException(
        `El plan ${plan.name} tiene más cuotas iniciales que cuotas totales.`,
      );
    }

    for (let i = 0; i < totalInstallments; i++) {
      const due = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + i,
        paymentDay,
        12,
        0,
        0,
      );

      const amount =
        i < firstInstallmentsCount
          ? firstInstallmentAmount
          : remainingInstallmentAmount;

      const inst = this.instRepo.create({
        sale,
        saleId: sale.id,
        client,
        clientId: client.id,
        concept: 'MOTO_PLAN',
        amount,
        remainingAmount: amount,
        dueDate: due,
        paid: false,
        status: InstallmentStatus.PENDING,
        installmentNumber: i + 1,
        totalInstallments,
        receiver: InstallmentReceiver.AGENCY,
      } as Partial<Installment>);

      await this.instRepo.save(inst);
    }

    // El anticipo no se genera como cuota.
    // Se guarda en sale.downPayment y aparece en el comprobante.
    if (downPayment < 0) {
      throw new BadRequestException(
        `El plan ${plan.name} tiene un anticipo inválido.`,
      );
    }
  }

  // 🧾 Crear nueva venta (VALIDA categoría)
  async create(
    dto: CreateSaleDto,
    user: any,
    sellerId?: number,
    sellerName?: string,
  ) {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    this.assertCanAccessVehicleCategory(user, (vehicle as any)?.category);

    const client = await this.clientRepo.findOne({
      where: { dni: dto.clientDni },
    });

    const inHouseAmount = Number(dto.inHouseAmount ?? 0);
    const inHouseInstallments = Number(dto.inHouseInstallments ?? 0);

    const isMotoPlan = dto.paymentType === 'plan_motos_0km';

    if (
      (inHouseAmount > 0 && inHouseInstallments > 0 && !client) ||
      (isMotoPlan && !client)
    ) {
      throw new NotFoundException('Client not found');
    }

    let motoPlan: MotoPlanConfig | null = null;
    if (isMotoPlan) {
      if (!dto.motoPlanCode) {
        throw new BadRequestException(
          'Debe indicar el código del plan de motos.',
        );
      }

      motoPlan = await this.getMotoPlanConfig(dto.motoPlanCode);
      if (!motoPlan) {
        throw new NotFoundException('Moto plan not found');
      }
    }

    const sale = this.salesRepo.create({
      ...dto,
      paymentType: dto.paymentType ?? 'contado',
      motoPlanCode: dto.motoPlanCode ?? null,
      client: client ?? undefined,

      sellerId: sellerId ?? null,
      sellerName: sellerName ?? null,

      hasTradeIn: dto.hasTradeIn,
      tradeInValue: dto.tradeInValue,
      tradeInPlate: dto.tradeInPlate ?? null,

      paymentComposition: {
        hasAdvance: (dto.downPayment ?? 0) > 0,
        hasPrendario:
          (dto.prendarioAmount ?? 0) > 0 &&
          (dto.prendarioInstallments ?? 0) > 0,
        hasPersonal:
          (dto.personalAmount ?? 0) > 0 &&
          (dto.personalInstallments ?? 0) > 0,
        hasFinancing:
          (dto.inHouseAmount ?? 0) > 0 &&
          (dto.inHouseInstallments ?? 0) > 0,
      },
    });

    const saved = await this.salesRepo.save(sale);
    vehicle.status = 'Sold';
    await this.vehicleRepo.save(vehicle);

    // 💳 Generar cuotas de financiación personal
    const planRatePercent =
      Number(dto.inHouseMonthlyRate ?? 0) ||
      (await this.getRate('financiacion', inHouseInstallments));

    const totalWithInterest =
      planRatePercent > 0
        ? inHouseAmount * (1 + planRatePercent / 100)
        : inHouseAmount;

    const installmentValue =
      inHouseInstallments > 0
        ? parseFloat((totalWithInterest / inHouseInstallments).toFixed(2))
        : 0;

    if (
      dto.paymentType !== 'plan_motos_0km' &&
      inHouseAmount > 0 &&
      inHouseInstallments > 0
    ) {
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
          sale: saved,
          saleId: saved.id,
          client: client!,
          clientId: client!.id,
          concept: 'PERSONAL_FINANCING',
          amount: installmentValue,
          remainingAmount: installmentValue,
          dueDate: due,
          paid: false,
          status: InstallmentStatus.PENDING,
          installmentNumber: i + 1,
          totalInstallments: inHouseInstallments,
          receiver: InstallmentReceiver.AGENCY,
        } as Partial<Installment>);

        await this.instRepo.save(inst);
      }
    }

    // 🏍️ Generar cuotas del plan motos
    if (isMotoPlan && client && motoPlan) {
      await this.createMotoPlanInstallments(saved, client, dto, motoPlan);
    }

    try {
      const clientEmail =
        (saved as any)?.client?.email || (client as any)?.email;

      if (clientEmail) {
        const pdfBuffer = await this.getPdf(saved.id);

        const vehicleLabel = saved.vehicle
          ? `${saved.vehicle.brand} ${saved.vehicle.model}${
              saved.vehicle.versionName ? ` ${saved.vehicle.versionName}` : ''
            }`.trim()
          : 'Vehículo';

        const html = `
          <p>Hola ${saved.clientName ?? ''},</p>

          <p>Te enviamos el comprobante de la compra realizada.</p>

          <ul>
            <li><strong>Venta Nº:</strong> ${saved.id}</li>
            <li><strong>Vehículo:</strong> ${vehicleLabel}</li>
            <li><strong>Fecha:</strong> ${new Date(saved.createdAt).toLocaleDateString('es-AR')}</li>
            <li><strong>Forma de pago:</strong> ${this.labelPayment(saved.paymentComposition, saved.paymentType) || '-'}</li>
          </ul>

          <p>Adjunto vas a encontrar el PDF del comprobante.</p>

          <p>
            Saludos,<br/>
            <strong>GL Motors</strong>
          </p>
        `;

        await this.mailService.sendWithPdf({
          to: clientEmail,
          subject: `Comprobante de Venta #${saved.id} - ${vehicleLabel}`,
          filename: `venta_${saved.id}.pdf`,
          pdfBuffer,
          html,
        });

        console.log('✅ Venta enviada por email a:', clientEmail);
      } else {
        console.warn(
          `⚠️ La venta ${saved.id} no tiene email de cliente cargado.`,
        );
      }
    } catch (err) {
      console.error(
        `❌ No se pudo enviar la venta ${saved.id} por email (la venta se creó igual):`,
        err,
      );
    }

    return saved;
  }

  // 📋 Listar todas las ventas (FILTRADO por categoría)
  async findAll(user: any) {
    const allowed = this.getAllowedCategories(user);
    if (!allowed.length) {
      throw new ForbiddenException('No tenés permisos para ver ventas.');
    }

    return this.salesRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('sale.client', 'client')
      .where("COALESCE(vehicle.category, 'CAR') IN (:...allowed)", { allowed })
      .orderBy('sale.createdAt', 'DESC')
      .getMany();
  }

  // 🔎 Buscar una venta (VALIDA categoría)
  async findOne(id: number, user: any) {
    const sale = await this.salesRepo.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    this.assertCanAccessVehicleCategory(user, (sale as any)?.vehicle?.category);

    return sale;
  }

  // 🔒 Uso interno (PDF). No aplica control por categoría.
  private async findOneInternal(id: number) {
    const sale = await this.salesRepo.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  // 🆕 Helper: obtener tasa desde loan_rates
  private async getRate(
    type: 'prendario' | 'personal' | 'financiacion',
    months?: number | null,
  ): Promise<number> {
    if (!months) return 0;

    let bracket: number;
    if (months <= 12) {
      bracket = 12;
    } else if (months <= 24) {
      bracket = 24;
    } else if (months <= 36) {
      bracket = 36;
    } else {
      return 0;
    }

    const row = await this.loanRateRepo.findOne({
      where: { type, months: bracket },
    });
    return row?.rate ?? 0;
  }

  // 🖨️ PDF
  async getPdf(id: number): Promise<Buffer> {
    const sale = await this.findOneInternal(id);

    const motoPlan =
      sale.paymentType === 'plan_motos_0km' && sale.motoPlanCode
        ? await this.getMotoPlanConfig(sale.motoPlanCode)
        : null;

    const isMotoPlan = !!motoPlan;

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
        doc
          .opacity(0.07)
          .image(logoPath, 100, 180, { fit: [400, 400], align: 'center' });
        doc.opacity(1);
      }
    } catch {
      console.warn('⚠️ No se pudo cargar el logo de marca de agua');
    }

    doc
      .fontSize(22)
      .fillColor('#1e1e1e')
      .text('GL Motors', { align: 'center' });
    doc
      .fontSize(12)
      .fillColor('#555')
      .text('Comprobante de Venta', { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#777')
      .text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, {
        align: 'center',
      });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
    doc.moveDown(1);

    const sectionTitle = (t: string) => {
      doc.moveDown(0.6);
      doc
        .fontSize(13)
        .fillColor('#009879')
        .text(t.toUpperCase(), { underline: true });
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

    sectionTitle('Datos de la Venta');
    doc.text(`Número: ${sale.id}`);
    doc.text(`Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-AR')}`);
    doc.text(
      `Forma de Pago: ${this.labelPayment(sale.paymentComposition, sale.paymentType) || '-'}`,
    );

    if (isMotoPlan && motoPlan) {
      const totalInstallments = Number(
        motoPlan.totalInstallments ?? motoPlan.installments ?? 0,
      );

      if (totalInstallments > 0) {
        doc.text(`Cantidad de Cuotas Totales: ${totalInstallments}`);
      }

      doc.text(`Día de Pago: ${sale.paymentDay}`);
      doc.text(`Mes Inicial de Pago: ${sale.initialPaymentMonth}`);
      doc.text(`Plan seleccionado: ${motoPlan.name || sale.motoPlanCode}`);
    } else {
      if (sale.personalInstallments) {
        doc.text(`Cantidad de Cuotas Totales: ${sale.personalInstallments}`);
      }
      doc.text(`Día de Pago: ${sale.paymentDay}`);
      doc.text(`Mes Inicial de Pago: ${sale.initialPaymentMonth}`);
    }

    sectionTitle('Detalle de Montos');

    if (isMotoPlan && motoPlan) {
      const totalInstallments = Number(
        motoPlan.totalInstallments ?? motoPlan.installments ?? 0,
      );
      const firstInstallmentsCount = Number(
        motoPlan.firstInstallmentsCount ?? 0,
      );
      const firstInstallmentAmount = Number(
        motoPlan.firstInstallmentAmount ?? 0,
      );
      const remainingInstallmentAmount = Number(
        motoPlan.remainingInstallmentAmount ?? 0,
      );
      const remainingCount = Math.max(
        totalInstallments - firstInstallmentsCount,
        0,
      );

      doc.text(`Detalle del ${motoPlan.name}`);

      if (sale.downPayment != null) {
        doc.text(`Anticipo: ${formatPesos(sale.downPayment)}`);
      }

      if (firstInstallmentsCount > 0 && firstInstallmentAmount > 0) {
        doc.text(
          `Primeras ${firstInstallmentsCount} cuotas: ${formatPesos(firstInstallmentAmount)}`,
        );
      }

      if (remainingCount > 0 && remainingInstallmentAmount > 0) {
        doc.text(
          `Siguientes ${remainingCount} cuotas: ${formatPesos(remainingInstallmentAmount)}`,
        );
      }

      if (totalInstallments > 0) {
        doc.text(`Total de cuotas: ${totalInstallments}`);
      }
    } else {
      if (sale.downPayment != null)
        doc.text(`Anticipo: ${formatPesos(sale.downPayment)}`);
      if (sale.tradeInValue != null)
        doc.text(`Valor de Permuta: ${formatPesos(sale.tradeInValue)}`);
      if (sale.basePrice != null)
        doc.text(`Precio Lista: ${formatPesos(sale.basePrice)}`);
      if (sale.balance != null)
        doc.text(`Saldo (vehículo - permuta): ${formatPesos(sale.balance)}`);
      if (sale.finalPrice != null)
        doc.text(`Precio Final de Venta: ${formatPesos(sale.finalPrice)}`);
    }

    const nPrendario = sale.prendarioInstallments ?? 0;
    const nPersonal = sale.personalInstallments ?? 0;
    const nFinanc = sale.inHouseInstallments ?? 0;

    const netoPrendario = sale.prendarioAmount ?? 0;
    const netoPersonal = sale.personalAmount ?? 0;
    const netoFinanciacion = sale.inHouseAmount ?? 0;

    const tasaPrendario =
      netoPrendario > 0 && nPrendario > 0
        ? await this.getRate('prendario', nPrendario)
        : 0;
    const tasaPersonal =
      netoPersonal > 0 && nPersonal > 0
        ? await this.getRate('personal', nPersonal)
        : 0;
    const tasaFinanciacion =
      netoFinanciacion > 0 && nFinanc > 0
        ? await this.getRate('financiacion', nFinanc)
        : 0;

    const prendarioConInteres =
      netoPrendario > 0 ? netoPrendario * (1 + tasaPrendario / 100) : 0;
    const personalConInteres =
      netoPersonal > 0 ? netoPersonal * (1 + tasaPersonal / 100) : 0;
    const financiacionConInteres =
      netoFinanciacion > 0 ? netoFinanciacion * (1 + tasaFinanciacion / 100) : 0;

    const totalPrestamosConInteres =
      prendarioConInteres + personalConInteres + financiacionConInteres;

    const nCuotasGlobal =
      sale.personalInstallments ||
      sale.prendarioInstallments ||
      sale.inHouseInstallments ||
      0;

    const valorCuotaTotalConInteres =
      nCuotasGlobal > 0 && totalPrestamosConInteres > 0
        ? totalPrestamosConInteres / nCuotasGlobal
        : 0;

    const hasLoans =
      !!sale.prendarioAmount || !!sale.personalAmount || !!sale.inHouseAmount;

    if (!isMotoPlan && hasLoans) {
      sectionTitle('Detalle de Préstamos y Financiaciones');

      if (valorCuotaTotalConInteres > 0) {
        doc.text(
          `Valor de Cuota total (con financiación): ${formatPesos(
            valorCuotaTotalConInteres,
          )}`,
        );
        doc.moveDown(0.5);
      }

      if (sale.prendarioAmount && sale.prendarioAmount > 0) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Préstamo Prendario');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Monto (neto): ${formatPesos(sale.prendarioAmount)}`);
        if (tasaPrendario) {
          doc.text(`Tasa aplicada: ${tasaPrendario}%`);
        }
        doc.text(`Cuotas: ${sale.prendarioInstallments ?? '-'}`);
        if (prendarioConInteres > 0 && nPrendario > 0) {
          const cuota = prendarioConInteres / nPrendario;
          doc.text(
            `Valor de cada cuota (con financiación): ${formatPesos(cuota)}`,
          );
        }
      }

      if (sale.personalAmount && sale.personalAmount > 0) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Préstamo Personal');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Monto (neto): ${formatPesos(sale.personalAmount)}`);
        if (tasaPersonal) {
          doc.text(`Tasa aplicada: ${tasaPersonal}%`);
        }
        doc.text(`Cuotas: ${sale.personalInstallments ?? '-'}`);
        if (personalConInteres > 0 && nPersonal > 0) {
          const cuota = personalConInteres / nPersonal;
          doc.text(
            `Valor de cada cuota (con financiación): ${formatPesos(cuota)}`,
          );
        }
      }

      if (sale.inHouseAmount && sale.inHouseAmount > 0) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Financiación Personal');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Monto (neto): ${formatPesos(sale.inHouseAmount)}`);
        if (tasaFinanciacion) {
          doc.text(`Tasa aplicada: ${tasaFinanciacion}%`);
        }
        doc.text(`Cuotas: ${sale.inHouseInstallments ?? '-'}`);
        if (financiacionConInteres > 0 && nFinanc > 0) {
          const cuota = financiacionConInteres / nFinanc;
          doc.text(
            `Valor de cada cuota (con financiación): ${formatPesos(cuota)}`,
          );
        }
      }

      if (
        sale.paymentComposition?.hasFinancing &&
        sale.inHouseAmount > 0 &&
        sale.inHouseInstallments > 0
      ) {
        doc.moveDown(0.8);
        doc
          .fontSize(12)
          .fillColor('#009879')
          .text('Detalle de Cuotas Financiación Personal');
        doc.fontSize(11).fillColor('#000');
        doc.text(`Cantidad de Cuotas: ${sale.inHouseInstallments}`);

        const baseFin =
          financiacionConInteres > 0 ? financiacionConInteres : sale.inHouseAmount;
        const valorCuota = baseFin / sale.inHouseInstallments;

        doc.text(`Valor de cada cuota: ${formatPesos(valorCuota)}`);
      }
    }

    sectionTitle('Cliente');
    doc.text(`Nombre: ${sale.clientName}`);
    doc.text(`DNI: ${sale.clientDni}`);

    if (sale.vehicle) {
      sectionTitle('Vehículo');
      doc.text(
        `${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.versionName || ''}`,
      );
      if (sale.vehicle.year) doc.text(`Año: ${sale.vehicle.year}`);
      if (sale.vehicle.color) doc.text(`Color: ${sale.vehicle.color}`);
      if (sale.vehicle.plate) doc.text(`Patente: ${sale.vehicle.plate}`);
    }

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
    doc
      .fontSize(8.5)
      .fillColor('#555')
      .text(legales, { align: 'justify', lineGap: 2.5 });

    doc.end();
    await done;
    const pdfBuffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, pdfBuffer);
    return pdfBuffer;
  }

  private labelPayment(
    comp?: {
      hasAdvance?: boolean;
      hasPrendario?: boolean;
      hasPersonal?: boolean;
      hasFinancing?: boolean;
    } | null,
    paymentType?: string | null,
  ): string {
    if (paymentType === 'plan_motos_0km') {
      return 'Plan Motos 0km';
    }

    if (!comp) return '-';

    const hasAnyFinancing =
      !!comp.hasPrendario || !!comp.hasPersonal || !!comp.hasFinancing;

    if (hasAnyFinancing) {
      return 'Anticipo + Financiación';
    }

    return 'Contado';
  }
}