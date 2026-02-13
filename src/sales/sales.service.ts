import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Sale } from './sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Installment } from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';
import { LoanRate } from '../loan-rates/loan-rate.entity'; // 🆕 import tasas
import PDFDocument from 'pdfkit'; // ✅ Import corregido
import * as fs from 'fs';
import * as path from 'path';
import { MailService } from '../mail/mail.service'; // ✅ NUEVO (email)

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
    @InjectRepository(LoanRate) private readonly loanRateRepo: Repository<LoanRate>, // 🆕 repo tasas
    private readonly mailService: MailService, // ✅ NUEVO
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
        status: In(['Accepted', 'accepted', 'Aceptada', 'aceptada']),
      },
      relations: ['vehicle', 'client'],
    });

    const reservedVehicles = acceptedRes.map((r) => r.vehicle).filter(Boolean);
    const map = new Map<number, Vehicle>();
    for (const v of [...available, ...reservedVehicles]) map.set(v.id, v);
    return Array.from(map.values());
  }

  // 🧾 Crear nueva venta
  async create(dto: CreateSaleDto, sellerId?: number, sellerName?: string) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const client = await this.clientRepo.findOne({ where: { dni: dto.clientDni } });

    // ✅ VALIDACIÓN A AGREGAR ACÁ
    const inHouseAmount = Number(dto.inHouseAmount ?? 0);
    const inHouseInstallments = Number(dto.inHouseInstallments ?? 0);

    if (inHouseAmount > 0 && inHouseInstallments > 0 && !client) {
      throw new NotFoundException('Client not found');
    }
    // 🔚 FIN VALIDACIÓN

    const sale = this.salesRepo.create({
      ...dto,
      client: client ?? undefined,

      // 🧑‍💼 Vendedor
      sellerId: sellerId ?? null,
      sellerName: sellerName ?? null,

      // 👇 mapeamos explícitamente los campos de permuta
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

    // 💳 Generar plan de pagos (financiación interna)

    // 1) tasa: si el front manda 0, buscamos la del plan en loan_rates
    const planRatePercent =
      Number(dto.inHouseMonthlyRate ?? 0) ||
      (await this.getRate('financiacion', inHouseInstallments)); // devuelve % (ej: 115)

    // 2) monto total con interés, consistente con el preview del front
    const totalWithInterest =
      planRatePercent > 0
        ? inHouseAmount * (1 + planRatePercent / 100)
        : inHouseAmount;

    // 3) valor de cuota: total con interés / cantidad de cuotas
    const installmentValue = parseFloat(
      (totalWithInterest / inHouseInstallments).toFixed(2),
    );

    if (inHouseAmount > 0 && inHouseInstallments > 0) {
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

          client: client!, // importante para que quede clientId
          clientId: client!.id,

          concept: 'PERSONAL_FINANCING',

          // Monto original de la cuota
          amount: installmentValue,

          // ✅ Saldo pendiente inicial = monto original
          remainingAmount: installmentValue,

          dueDate: due,

          // ✅ Estado inicial
          paid: false,
          status: 'PENDING',

          // ✅ Datos de posición dentro del plan
          installmentNumber: i + 1,
          totalInstallments: inHouseInstallments,
        } as Partial<Installment>);

        await this.instRepo.save(inst);
      }
    }

    // ✅ Opción B: enviar email SOLO al crear la venta
    try {
      const clientEmail = (saved as any)?.client?.email || (client as any)?.email;

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
            <li><strong>Forma de pago:</strong> ${this.labelPayment(saved.paymentComposition) || '-'}</li>
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
        console.warn(`⚠️ La venta ${saved.id} no tiene email de cliente cargado.`);
      }
    } catch (err) {
      console.error(
        `❌ No se pudo enviar la venta ${saved.id} por email (la venta se creó igual):`,
        err,
      );
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

  // 🆕 Helper: obtener tasa desde la tabla loan_rates, aplicando tramos 1–12 / 13–24 / 25–36
  private async getRate(
    type: 'prendario' | 'personal' | 'financiacion',
    months?: number | null,
  ): Promise<number> {
    if (!months) return 0;

    // Normalizamos la cantidad real de cuotas al tramo configurado:
    // 1–12  -> usa la tasa de 12
    // 13–24 -> usa la tasa de 24
    // 25–36 -> usa la tasa de 36
    let bracket: number;
    if (months <= 12) {
      bracket = 12;
    } else if (months <= 24) {
      bracket = 24;
    } else if (months <= 36) {
      bracket = 36;
    } else {
      // Fuera del rango soportado, no aplicamos tasa
      return 0;
    }

    const row = await this.loanRateRepo.findOne({
      where: { type, months: bracket },
    });
    return row?.rate ?? 0;
  }

  // 🖨️ Generar comprobante de venta profesional (SOLO GENERA, NO ENVÍA EMAIL)
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
        doc
          .opacity(0.07)
          .image(logoPath, 100, 180, { fit: [400, 400], align: 'center' });
        doc.opacity(1);
      }
    } catch {
      console.warn('⚠️ No se pudo cargar el logo de marca de agua');
    }

    // 🏷️ Encabezado
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

    // Helpers
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

    // 📋 Datos de la venta
    sectionTitle('Datos de la Venta');
    doc.text(`Número: ${sale.id}`);
    doc.text(
      `Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-AR')}`,
    );
    doc.text(
      `Forma de Pago: ${this.labelPayment(sale.paymentComposition) || '-'}`,
    );
    if (sale.personalInstallments)
      doc.text(`Cantidad de Cuotas Totales: ${sale.personalInstallments}`);
    doc.text(`Día de Pago: ${sale.paymentDay}`);
    doc.text(`Mes Inicial de Pago: ${sale.initialPaymentMonth}`);

    // 💸 Montos principales
    sectionTitle('Detalle de Montos');
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

    // 🧮 Tasas y montos con financiación (similar al preview)
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

    if (hasLoans) {
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
          financiacionConInteres > 0
            ? financiacionConInteres
            : sale.inHouseAmount;
        const valorCuota = baseFin / sale.inHouseInstallments;

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
      doc.text(
        `${sale.vehicle.brand} ${sale.vehicle.model} ${
          sale.vehicle.versionName || ''
        }`,
      );
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

  // 👇 NUEVA LÓGICA DE ETIQUETA DE FORMA DE PAGO PARA EL PDF
  private labelPayment(comp?: {
    hasAdvance?: boolean;
    hasPrendario?: boolean;
    hasPersonal?: boolean;
    hasFinancing?: boolean;
  } | null): string {
    if (!comp) return '-';

    const hasAnyFinancing =
      !!comp.hasPrendario || !!comp.hasPersonal || !!comp.hasFinancing;

    if (hasAnyFinancing) {
      return 'Anticipo + Financiación';
    }

    return 'Contado';
  }
}
