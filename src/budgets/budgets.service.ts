import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Budget } from './budget.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { LoanRate } from '../loan-rates/loan-rate.entity';
import { BudgetReportsService } from '../budget-reports/budget-reports.service';
import { MailService } from '../mail/mail.service';
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

    // 👇 Servicio de reportes inyectado
    private readonly budgetReportsService: BudgetReportsService,

    // 👇 Email (Gmail SMTP)
    private readonly mailService: MailService,
  ) {}

  async findAll(): Promise<Budget[]> {
    return this.budgetsRepository.find({
      relations: ['vehicle', 'client'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Budget> {
    const budget = await this.budgetsRepository.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });

    if (!budget) {
      throw new NotFoundException(`Presupuesto con id ${id} no encontrado`);
    }

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

    // 🔄 Normalizar montos provenientes del frontend (soporta nombres antiguos y nuevos)
    // ⬇️ lo pasamos a let para poder ajustarlo en el caso especial
    let downPayment = dto.downPayment != null ? Number(dto.downPayment) : 0;

    const hasTradeIn = dto.hasTradeIn === true || dto.hasTradeIn === 'true';
    const tradeInValue =
      hasTradeIn && dto.tradeInValue != null ? Number(dto.tradeInValue) : 0;

    const prendarioAmount =
      dto.prendarioAmount != null
        ? Number(dto.prendarioAmount)
        : dto.montoPrendario != null
        ? Number(dto.montoPrendario)
        : 0;

    const personalAmount =
      dto.personalAmount != null
        ? Number(dto.personalAmount)
        : dto.montoPersonal != null
        ? Number(dto.montoPersonal)
        : 0;

    const financiacionAmount =
      dto.financiacionAmount != null
        ? Number(dto.financiacionAmount)
        : dto.montoFinanciacion != null
        ? Number(dto.montoFinanciacion)
        : 0;

    // Normalizar nuevamente sobre dto.* para el resto de la lógica
    dto.prendarioAmount = prendarioAmount || null;
    dto.personalAmount = personalAmount || null;
    dto.financiacionAmount = financiacionAmount || null;

    const vehiclePrice = Number(vehicle.price) || 0;

    // ⭐ Caso especial: PERMUTA + CONTADO sin financiación
    // Front muestra saldo pero puede no mandarlo como downPayment.
    // Antes dependía de paymentType === 'CASH'; ahora solo de la composición real.
    if (
      hasTradeIn &&
      downPayment === 0 &&
      prendarioAmount === 0 &&
      personalAmount === 0 &&
      financiacionAmount === 0
    ) {
      const saldoEsperado = vehiclePrice - tradeInValue;

      if (saldoEsperado < 0) {
        throw new BadRequestException(
          'El valor de la permuta no puede ser mayor al precio del vehículo.',
        );
      }

      // Si hay saldo a pagar, lo seteamos como anticipo
      if (Math.abs(saldoEsperado) > 1) {
        downPayment = saldoEsperado;
        dto.downPayment = saldoEsperado;

        console.log(
          '💡 Ajuste automático de anticipo para PERMUTA + CONTADO:',
          { vehiclePrice, tradeInValue, downPayment },
        );
      }
    }

    // ✅ Regla de negocio: la suma de anticipo + permuta + financiaciones
    // debe coincidir con el precio del vehículo
    const totalComposition =
      downPayment +
      tradeInValue +
      prendarioAmount +
      personalAmount +
      financiacionAmount;

    const someAmountEntered =
      downPayment ||
      tradeInValue ||
      prendarioAmount ||
      personalAmount ||
      financiacionAmount;

    if (someAmountEntered) {
      const diff = Math.abs(totalComposition - vehiclePrice);
      if (diff > 1) {
        console.error('❌ Composición inválida en presupuesto', {
          vehiclePrice,
          downPayment,
          tradeInValue,
          prendarioAmount,
          personalAmount,
          financiacionAmount,
          totalComposition,
        });
        throw new BadRequestException(
          'La suma de anticipo, permuta y financiaciones debe coincidir con el precio del vehículo. Revise los importes.',
        );
      }
    }

    // Cantidad de cuotas solicitadas (1..36)
    const installmentsCount: number = Number(dto.installments) || 0;

    // Mapeo de tramos para tasas:
    const bracketMonths =
      installmentsCount <= 0
        ? null
        : installmentsCount <= 12
        ? 12
        : installmentsCount <= 24
        ? 24
        : installmentsCount <= 36
        ? 36
        : null;

    // 🧮 Buscar tasas según el tipo de préstamo y meses del tramo
    const prendarioRate = bracketMonths
      ? await this.loanRatesRepository.findOne({
          where: { type: 'prendario', months: bracketMonths },
        })
      : null;
    const personalRate = bracketMonths
      ? await this.loanRatesRepository.findOne({
          where: { type: 'personal', months: bracketMonths },
        })
      : null;
    const financiacionRate = bracketMonths
      ? await this.loanRatesRepository.findOne({
          where: { type: 'financiacion', months: bracketMonths },
        })
      : null;

    console.log('📊 Tasas aplicadas:', {
      prendarioRate: prendarioRate?.rate,
      personalRate: personalRate?.rate,
      financiacionRate: financiacionRate?.rate,
    });

    // 💰 Aplicar tasas si existen (monto final con interés simple agregado)
    const prendarioConInteres =
      dto.prendarioAmount != null
        ? dto.prendarioAmount * (1 + (prendarioRate?.rate || 0) / 100)
        : 0;

    const personalConInteres =
      dto.personalAmount != null
        ? dto.personalAmount * (1 + (personalRate?.rate || 0) / 100)
        : 0;

    const financiacionConInteres =
      dto.financiacionAmount != null
        ? dto.financiacionAmount * (1 + (financiacionRate?.rate || 0) / 100)
        : 0;

    // 🔹 Calcular total final con intereses
    const finalPrice =
      downPayment +
      tradeInValue +
      (prendarioConInteres || 0) +
      (personalConInteres || 0) +
      (financiacionConInteres || 0);

    // 💵 Calcular valor de cuota total (suma de montos financiados / cuotas)
    const totalPrestamos =
      (prendarioConInteres || 0) +
      (personalConInteres || 0) +
      (financiacionConInteres || 0);

    const installments: number = installmentsCount;
    const installmentValue =
      installments > 0 && totalPrestamos > 0
        ? totalPrestamos / installments
        : undefined;

    // 🧾 Crear el presupuesto correctamente tipado
    const budgetBase: DeepPartial<Budget> = {
      vehicle,
      client,
      // siempre tomamos el precio real del vehículo
      price: vehicle.price,
      status: dto.status ?? 'pending',
      paymentType: dto.paymentType ?? null,
      installments,
      finalPrice,
      installmentValue,
      // Campos opcionales
      downPayment: downPayment || undefined,
      tradeInValue: tradeInValue || undefined,
      prendarioMonths: dto.prendarioMonths ?? undefined,
      personalMonths: dto.personalMonths ?? undefined,
      financiacionMonths: dto.financiacionMonths ?? undefined,
    };

    // Agregar tasas y montos solo si existen
    if (prendarioRate?.rate != null) budgetBase.prendarioRate = prendarioRate.rate;
    if (personalRate?.rate != null) budgetBase.personalRate = personalRate.rate;
    if (financiacionRate?.rate != null)
      budgetBase.financiacionRate = financiacionRate.rate;

    if (prendarioAmount) budgetBase.prendarioAmount = prendarioAmount;
    if (personalAmount) budgetBase.personalAmount = personalAmount;
    if (financiacionAmount) budgetBase.financiacionAmount = financiacionAmount;

    console.log('✅ Budget base a guardar:', budgetBase);

    const budget = this.budgetsRepository.create(budgetBase);
    const saved = await this.budgetsRepository.save(budget);

    // 📊 Crear registro en budget_reports (sin romper si falla)
    try {
      await this.budgetReportsService.create({
        budgetId: saved.id,
        vehicleId: vehicle.id,
        clientId: client.id,
        sellerId: dto.sellerId ?? null,
        paymentType: dto.paymentType ?? 'N/A',
        listPrice: Number(vehicle.price) || 0,
        finalPrice: finalPrice,
        installments,
        installmentValue: installmentValue ?? undefined,
        downPayment: downPayment || undefined,
        status: dto.status ?? 'pending',
      });
    } catch (error) {
      console.error(
        '❌ Error al crear BudgetReport para el presupuesto',
        saved.id,
        error,
      );
      // No relanzamos el error para no impedir la creación del presupuesto
    }

    // ✅ Opción B: enviar email SOLO al crear el presupuesto
    try {
      const clientEmail = (client as any)?.email;
      if (clientEmail) {
        const pdfBuffer = await this.getPdf(saved.id);

        const vehicleLabel = vehicle
          ? `${vehicle.brand} ${vehicle.model}${
              vehicle.versionName ? ` ${vehicle.versionName}` : ''
            }`
          : 'Vehículo';

        const html = `
          <p>Hola ${client?.firstName ?? ''} ${client?.lastName ?? ''},</p>

          <p>Te enviamos el presupuesto solicitado.</p>

          <ul>
            <li><strong>Presupuesto Nº:</strong> ${saved.id}</li>
            <li><strong>Vehículo:</strong> ${vehicleLabel}</li>
            <li><strong>Fecha:</strong> ${new Date(saved.createdAt).toLocaleDateString('es-AR')}</li>
          </ul>

          <p>Adjunto vas a encontrar el PDF del presupuesto.</p>

          <p>
            Saludos,<br/>
            <strong>GL Motors</strong>
          </p>
        `;

        await this.mailService.sendWithPdf({
          to: clientEmail,
          subject: `Presupuesto #${saved.id} - ${vehicleLabel}`,
          filename: `Presupuesto-${saved.id}.pdf`,
          pdfBuffer,
          html,
        });

        console.log('✅ Presupuesto enviado por email a:', clientEmail);
      } else {
        console.warn(
          `⚠️ El cliente del presupuesto ${saved.id} no tiene email cargado.`,
        );
      }
    } catch (err) {
      console.error(
        `❌ No se pudo enviar el presupuesto ${saved.id} por email (el presupuesto se creó igual):`,
        err,
      );
    }

    return saved;
  }

  async update(id: number, dto: any) {
    const budget = await this.findOne(id);

    if (dto.status) {
      budget.status = dto.status;
    }

    if (dto.paymentType !== undefined) budget.paymentType = dto.paymentType;
    if (dto.installments !== undefined) budget.installments = dto.installments;
    if (dto.downPayment !== undefined) budget.downPayment = dto.downPayment;
    if (dto.tradeInValue !== undefined) budget.tradeInValue = dto.tradeInValue;
    if (dto.prendarioAmount !== undefined)
      budget.prendarioAmount = dto.prendarioAmount;
    if (dto.personalAmount !== undefined)
      budget.personalAmount = dto.personalAmount;
    if (dto.financiacionAmount !== undefined)
      budget.financiacionAmount = dto.financiacionAmount;
    if (dto.finalPrice !== undefined) budget.finalPrice = dto.finalPrice;
    if (dto.installmentValue !== undefined)
      budget.installmentValue = dto.installmentValue;

    if (dto.prendarioRate !== undefined) budget.prendarioRate = dto.prendarioRate;
    if (dto.personalRate !== undefined) budget.personalRate = dto.personalRate;
    if (dto.financiacionRate !== undefined)
      budget.financiacionRate = dto.financiacionRate;

    if (dto.prendarioMonths !== undefined)
      budget.prendarioMonths = dto.prendarioMonths;
    if (dto.personalMonths !== undefined)
      budget.personalMonths = dto.personalMonths;
    if (dto.financiacionMonths !== undefined)
      budget.financiacionMonths = dto.financiacionMonths;

    return this.budgetsRepository.save(budget);
  }

  async remove(id: number) {
    const budget = await this.findOne(id);
    return this.budgetsRepository.remove(budget);
  }

  // 🖨️ Generar PDF similar al de venta pero para presupuesto
  // ✅ Opción B: getPdf SOLO GENERA el PDF. NO envía email.
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
        doc.opacity(0.07).image(logoPath, 100, 180, {
          fit: [400, 400],
          align: 'center',
        });
        doc.opacity(1);
      }
    } catch {
      console.warn('⚠️ No se pudo cargar el logo de marca de agua');
    }

    // Encabezado
    doc.fontSize(22).fillColor('#1e1e1e').text('GL Motors', {
      align: 'center',
    });
    doc.fontSize(12).fillColor('#555').text('Presupuesto de Venta', {
      align: 'center',
    });
    doc.fontSize(10).fillColor('#777').text(
      `Emitido el ${new Date().toLocaleDateString('es-AR')}`,
      {
        align: 'center',
      },
    );
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

    const formatPesos = (valor?: number | null): string => {
      if (valor == null) return '-';
      return `$ ${valor.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    // Datos del presupuesto
    sectionTitle('Datos del Presupuesto');
    doc.text(`Número: ${budget.id}`);
    doc.text(
      `Fecha: ${new Date(budget.createdAt).toLocaleDateString('es-AR')}`,
    );
    if (budget.paymentType) {
      doc.text(`Forma de Pago: ${budget.paymentType}`);
    }
    if (budget.installments) {
      doc.text(`Cantidad de Cuotas: ${budget.installments}`);
    }

    // Montos principales
    sectionTitle('Detalle de Montos');
    if (budget.downPayment != null)
      doc.text(`Anticipo: ${formatPesos(budget.downPayment)}`);
    if (budget.tradeInValue != null)
      doc.text(`Valor de Permuta: ${formatPesos(budget.tradeInValue)}`);
    if (budget.price != null) doc.text(`Precio Lista: ${formatPesos(budget.price)}`);
    if (budget.installmentValue != null)
      doc.text(`Valor de Cuota Total: ${formatPesos(budget.installmentValue)}`);

    // Detalle de préstamos
    const hasLoans =
      !!budget.prendarioAmount ||
      !!budget.personalAmount ||
      !!budget.financiacionAmount;

    if (hasLoans) {
      sectionTitle('Detalle de Préstamos y Financiaciones');

      const calcConInteres = (
        montoNeto?: number | null,
        tasa?: number | null,
      ) => {
        if (!montoNeto) return 0;
        if (!tasa) return montoNeto;
        return montoNeto * (1 + tasa / 100);
      };

      if (budget.prendarioAmount != null) {
        const montoNeto = budget.prendarioAmount;
        const montoConInteres = calcConInteres(
          budget.prendarioAmount,
          budget.prendarioRate,
        );
        const cuota =
          budget.installments && budget.installments > 0
            ? montoConInteres / budget.installments
            : 0;

        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Préstamo Prendario');
        doc
          .fontSize(11)
          .fillColor('#000')
          .text(`Cuotas: ${budget.installments ?? '-'}`)
          .text(
            `Valor de cada cuota (con financiación): ${formatPesos(cuota)}`,
          );
      }

      if (budget.personalAmount != null) {
        const montoNeto = budget.personalAmount;
        const montoConInteres = calcConInteres(
          budget.personalAmount,
          budget.personalRate,
        );
        const cuota =
          budget.installments && budget.installments > 0
            ? montoConInteres / budget.installments
            : 0;

        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Préstamo Personal');
        doc
          .fontSize(11)
          .fillColor('#000')
          .text(`Cuotas: ${budget.installments ?? '-'}`)
          .text(
            `Valor de cada cuota (con financiación): ${formatPesos(cuota)}`,
          );
      }

      if (budget.financiacionAmount != null) {
        const montoNeto = budget.financiacionAmount;
        const montoConInteres = calcConInteres(
          budget.financiacionAmount,
          budget.financiacionRate,
        );
        const cuota =
          budget.installments && budget.installments > 0
            ? montoConInteres / budget.installments
            : 0;

        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#009879').text('Financiación Personal');
        doc
          .fontSize(11)
          .fillColor('#000')
          .text(`Cuotas: ${budget.installments ?? '-'}`)
          .text(
            `Valor de cada cuota (con financiación): ${formatPesos(cuota)}`,
          );
      }
    }

    // Cliente
    if (budget.client) {
      sectionTitle('Cliente');
      doc.text(
        `Nombre: ${budget.client.firstName} ${budget.client.lastName}`,
      );
      if ((budget.client as any).dni) {
        doc.text(`DNI: ${(budget.client as any).dni}`);
      }
      if ((budget.client as any).email) {
        doc.text(`Email: ${(budget.client as any).email}`);
      }
      if ((budget.client as any).phone) {
        doc.text(`Teléfono: ${(budget.client as any).phone}`);
      }
    }

    // Vehículo
    if (budget.vehicle) {
      sectionTitle('Vehículo');
      doc.text(
        `${budget.vehicle.brand} ${budget.vehicle.model} ${
          budget.vehicle.versionName || ''
        }`,
      );
      if (budget.vehicle.year) doc.text(`Año: ${budget.vehicle.year}`);
      if (budget.vehicle.color) doc.text(`Color: ${budget.vehicle.color}`);
      if (budget.vehicle.plate) doc.text(`Patente: ${budget.vehicle.plate}`);
    }

    // Condiciones legales
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(1);
    doc
      .fontSize(13)
      .fillColor('#009879')
      .text('CONDICIONES LEGALES Y COMERCIALES', { underline: true });
    doc.moveDown(0.5);
    const legales = `
1. Naturaleza del presupuesto: El presente documento no implica obligación de compra ni reserva del vehículo. Tiene carácter informativo y refleja una propuesta comercial vigente a la fecha de emisión.
2. Vigencia: Los precios, tasas de financiación y condiciones aquí indicadas podrán variar sin previo aviso en función de modificaciones de listas de precios, condiciones de entidades financieras o disposiciones impositivas.
3. Financiación: La aprobación y condiciones definitivas de los préstamos (prendario, personal o financiación directa) quedan sujetas a evaluación crediticia, políticas de riesgo y documentación respaldatoria requerida por la entidad interviniente.
4. Entrega del vehículo: La entrega se realizará únicamente luego de acreditado el pago total del precio de venta o de cumplidas las condiciones mínimas acordadas en caso de financiación, incluyendo firma de documentación y eventuales garantías.
5. Permuta: El valor de la unidad usada tomada en parte de pago es estimativo y podrá ajustarse según el estado real del vehículo, documentación y tasación definitiva efectuada por el concesionario.
6. Modificaciones: Cualquier cambio en las condiciones aquí descriptas deberá constar por escrito en un nuevo presupuesto o anexo, firmado por las partes.
7. Aceptación: La firma del presente presupuesto por parte del cliente implica la lectura y aceptación de las condiciones detalladas, sin perjuicio de las posteriores formalidades contractuales que correspondan.
8. Información adicional: Para mayor detalle sobre tasas, plazos, seguros, gastos administrativos u otros cargos, el interesado podrá requerir información ampliatoria al momento de la inspección del vehículo por su parte.
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
}
