import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Loan, LoanStatus } from './loan.entity';
import {
  LoanFundMovement,
  LoanFundMovementType,
} from './loan-fund-movement.entity';
import { LoanClient } from '../loan-clients/loan-client.entity';
import {
  LoanInstallment,
  LoanInstallmentStatus,
} from '../loan-installments/loan-installment.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { PreviewLoanDto } from './dto/preview-loan.dto';
import {
  LOAN_PRODUCT_CONFIG,
  LoanProductType,
} from './loan-product.enum';
import {
  CashBoxMovement,
  CashBoxMovementType,
  CashBoxType,
} from '../cash-box-movements/cash-box-movement.entity';

@Injectable()
export class LoansService {
  private readonly INITIAL_FUND = 5000000;

  constructor(
    @InjectRepository(Loan)
    private readonly loansRepo: Repository<Loan>,

    @InjectRepository(LoanClient)
    private readonly loanClientsRepo: Repository<LoanClient>,

    @InjectRepository(LoanInstallment)
    private readonly loanInstallmentsRepo: Repository<LoanInstallment>,

    @InjectRepository(LoanFundMovement)
    private readonly fundMovementsRepo: Repository<LoanFundMovement>,

    private readonly dataSource: DataSource,
  ) {}

  private parseLocalDate(value: string | Date): Date {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const str = String(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    const parsed = new Date(str);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private toDateOnlyString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatDateAr(value: string | Date): string {
    const d = this.parseLocalDate(value);
    return d.toLocaleDateString('es-AR');
  }

  private formatPesos(value?: number | null): string {
    if (value == null) return '-';

    return `$ ${Number(value).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  calculateLoanValues(
    requestedAmount: number,
    weeklyInstallments: number,
    productType: LoanProductType = LoanProductType.KAIROS_STANDARD,
  ) {
    const amount = Number(requestedAmount);
    const installments = Number(weeklyInstallments);
    const config = LOAN_PRODUCT_CONFIG[productType];

    if (!config) {
      throw new BadRequestException('Producto financiero no válido.');
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('El monto solicitado debe ser mayor a 0.');
    }

    const glMotorsInstallments = [
      6, 8, 10, 12, 15, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36,
    ];

    const installmentsAreValid =
      productType === LoanProductType.GL_MOTORS
        ? glMotorsInstallments.includes(installments)
        : installments >= 1 && installments <= 12;

    if (!installments || !installmentsAreValid) {
      throw new BadRequestException(
        productType === LoanProductType.GL_MOTORS
          ? 'Las cuotas GL Motors deben ser 6, 8, 10, 12, 15, 18, 20, 22, 24, 26, 28, 30, 32, 34 o 36.'
          : 'La cantidad de cuotas semanales debe estar entre 1 y 12.',
      );
    }

    const expenses =
      config.expensesThreshold != null &&
      amount >= config.expensesThreshold
        ? config.fixedExpenses
        : 0;

    const calculationBaseAmount = amount + expenses;

    const interestAmount = Math.round(
      calculationBaseAmount *
        (config.monthlyInterestRate / 100) *
        (installments / 4),
    );

    const totalToReturn = calculationBaseAmount + interestAmount;
    const installmentAmount = Math.round(totalToReturn / installments);

    return {
      productType,
      requestedAmount: amount,
      expenses,
      calculationBaseAmount,
      weeklyInstallments: installments,
      monthlyInterestRate: config.monthlyInterestRate,
      dailyLateInterestRate: config.dailyLateInterestRate,
      interestAmount,
      totalToReturn,
      installmentAmount,
    };
  }


  /**
   * Crea un préstamo GL Motors dentro de una transacción ya abierta por SalesService.
   * La primera cuota vence exactamente en firstDueDate.
   */
  async createGlMotorsLoanWithManager(
    manager: EntityManager,
    params: {
      saleId: number;
      vehicleId: number;
      client: {
        firstName: string;
        lastName: string;
        dni: string;
        cuitCuil?: string | null;
        phone?: string | null;
        address?: string | null;
      };
      financedAmount: number;
      weeklyInstallments: number;
      firstDueDate: string;
      requestDate: string;
    },
  ): Promise<Loan> {
    const dni = String(params.client.dni ?? '').replace(/\D/g, '');
    const cuitCuil = String(params.client.cuitCuil ?? '').replace(/\D/g, '') || null;

    if (!dni) {
      throw new BadRequestException(
        'El DNI es obligatorio para crear la financiación Kairos.',
      );
    }

    let loanClient = await manager.findOne(LoanClient, {
      where: { dni },
    });

    if (!loanClient) {
      loanClient = manager.create(LoanClient, {
        firstName: params.client.firstName,
        lastName: params.client.lastName,
        cuitCuil,
        dni,
        phone: params.client.phone ?? null,
        workAddress: params.client.address ?? null,
        aliasOrCbu: null,
        dniPhotoPath: null,
        businessPhotoPath: null,
        serviceBillPath: null,
        bankAccountPath: null,
      });
      loanClient = await manager.save(loanClient);
    } else {
      let changed = false;
      if (!loanClient.cuitCuil && cuitCuil) {
        loanClient.cuitCuil = cuitCuil;
        changed = true;
      }
      if (!loanClient.dni) {
        loanClient.dni = dni;
        changed = true;
      }
      if (!loanClient.phone && params.client.phone) {
        loanClient.phone = params.client.phone;
        changed = true;
      }
      if (!loanClient.workAddress && params.client.address) {
        loanClient.workAddress = params.client.address;
        changed = true;
      }
      if (changed) loanClient = await manager.save(loanClient);
    }

    const values = this.calculateLoanValues(
      params.financedAmount,
      params.weeklyInstallments,
      LoanProductType.GL_MOTORS,
    );

    const loan = manager.create(Loan, {
      client: loanClient,
      clientId: loanClient.id,
      clientCuitCuil: loanClient.cuitCuil,
      clientDni: loanClient.dni,
      clientName: `${loanClient.firstName} ${loanClient.lastName}`.trim(),
      productType: LoanProductType.GL_MOTORS,
      requestedAmount: values.requestedAmount,
      expensesAmount: 0,
      calculationBaseAmount: values.calculationBaseAmount,
      interestAmount: values.interestAmount,
      totalToReturn: values.totalToReturn,
      installmentAmount: values.installmentAmount,
      requestDate: params.requestDate,
      weeklyInstallments: values.weeklyInstallments,
      monthlyInterestRate: 25,
      dailyLateInterestRate: 1,
      sourceSaleId: params.saleId,
      sourceVehicleId: params.vehicleId,
      status: LoanStatus.ACTIVE,
    });

    const savedLoan = await manager.save(loan);

    const firstDueDate = this.parseLocalDate(params.firstDueDate);
    const regularTotal =
      values.installmentAmount * Math.max(values.weeklyInstallments - 1, 0);
    const lastAmount =
      values.weeklyInstallments === 1
        ? values.totalToReturn
        : values.totalToReturn - regularTotal;

    for (let index = 0; index < values.weeklyInstallments; index += 1) {
      const due = new Date(firstDueDate);
      due.setDate(firstDueDate.getDate() + 7 * index);

      const amount =
        index === values.weeklyInstallments - 1
          ? lastAmount
          : values.installmentAmount;

      const installment = manager.create(LoanInstallment, {
        loan: savedLoan,
        loanId: savedLoan.id,
        client: loanClient,
        clientId: loanClient.id,
        amount,
        remainingAmount: amount,
        dueDate: this.toDateOnlyString(due),
        paid: false,
        status: LoanInstallmentStatus.PENDING,
        installmentNumber: index + 1,
        totalInstallments: values.weeklyInstallments,
        observations: `Financiación GL Motors - Venta #${params.saleId}`,
        lastPaymentAt: null,
        paymentDate: null,
      });

      await manager.save(installment);
    }

    const cashMovement = manager.create(CashBoxMovement, {
      boxType: CashBoxType.GL_MOTORS,
      movementType: CashBoxMovementType.LOAN_DISBURSEMENT,
      amount: -values.requestedAmount,
      principalAmount: -values.requestedAmount,
      interestAmount: 0,
      expenseAmount: 0,
      lateFeeAmount: 0,
      loanId: savedLoan.id,
      installmentId: null,
      paymentId: null,
      saleId: params.saleId,
      description: `Capital colocado por GL Motors en venta #${params.saleId}`,
    });

    await manager.save(cashMovement);

    return savedLoan;
  }

  async getAvailableFund(): Promise<number> {
    const rows = await this.fundMovementsRepo.find();

    if (!rows.length) return this.INITIAL_FUND;

    const totalMovements = rows.reduce(
      (acc, row) => acc + Number(row.amount),
      0,
    );

    return +(this.INITIAL_FUND + totalMovements).toFixed(2);
  }

  async preview(dto: PreviewLoanDto) {
    const client = await this.loanClientsRepo.findOne({
      where: { cuitCuil: dto.clientCuitCuil },
    });

    if (!client) {
      throw new NotFoundException('Cliente de préstamo no encontrado.');
    }

    const values = this.calculateLoanValues(
      dto.requestedAmount,
      dto.weeklyInstallments,
    );

    const availableFund = await this.getAvailableFund();

    const installments = this.buildInstallmentPreview(
      dto.requestDate,
      values.weeklyInstallments,
      values.installmentAmount,
      values.totalToReturn,
    );

    return {
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        cuitCuil: client.cuitCuil,
      },
      requestDate: dto.requestDate,
      ...values,
      availableFund,
      canCreate: availableFund >= values.requestedAmount,
      installments,
    };
  }

  private buildInstallmentPreview(
    requestDate: string,
    weeklyInstallments: number,
    installmentAmount: number,
    totalToReturn: number,
  ) {
    const base = this.parseLocalDate(requestDate);
    const regularInstallmentsTotal =
      installmentAmount * Math.max(weeklyInstallments - 1, 0);
    const lastInstallmentAmount =
      weeklyInstallments === 1
        ? totalToReturn
        : totalToReturn - regularInstallmentsTotal;

    return Array.from({ length: weeklyInstallments }).map((_, index) => {
      const due = new Date(base);
      due.setDate(base.getDate() + 7 * (index + 1));

      return {
        installmentNumber: index + 1,
        totalInstallments: weeklyInstallments,
        amount:
          index === weeklyInstallments - 1
            ? lastInstallmentAmount
            : installmentAmount,
        dueDate: this.toDateOnlyString(due),
      };
    });
  }

  async create(dto: CreateLoanDto): Promise<Loan> {
    const preview = await this.preview(dto);

    if (!preview.canCreate) {
      throw new BadRequestException(
        `Fondo insuficiente. Disponible: ${this.formatPesos(
          preview.availableFund,
        )}. Solicitado: ${this.formatPesos(preview.requestedAmount)}.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const client = await manager.findOne(LoanClient, {
        where: { cuitCuil: dto.clientCuitCuil },
      });

      if (!client) {
        throw new NotFoundException('Cliente de préstamo no encontrado.');
      }

      const values = this.calculateLoanValues(
        dto.requestedAmount,
        dto.weeklyInstallments,
      );

      const loan = manager.create(Loan, {
        client,
        clientId: client.id,
        clientCuitCuil: client.cuitCuil,
        clientDni: client.dni ?? null,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        productType: values.productType,
        requestedAmount: values.requestedAmount,
        expensesAmount: values.expenses,
        calculationBaseAmount: values.calculationBaseAmount,
        interestAmount: values.interestAmount,
        totalToReturn: values.totalToReturn,
        installmentAmount: values.installmentAmount,
        requestDate: dto.requestDate,
        weeklyInstallments: values.weeklyInstallments,
        monthlyInterestRate: values.monthlyInterestRate,
        dailyLateInterestRate: values.dailyLateInterestRate,
        sourceSaleId: null,
        sourceVehicleId: null,
        status: LoanStatus.ACTIVE,
      });

      const savedLoan = await manager.save(loan);

      const installmentPreview = this.buildInstallmentPreview(
        dto.requestDate,
        values.weeklyInstallments,
        values.installmentAmount,
        values.totalToReturn,
      );

      for (const item of installmentPreview) {
        const installment = manager.create(LoanInstallment, {
          loan: savedLoan,
          loanId: savedLoan.id,
          client,
          clientId: client.id,
          amount: item.amount,
          remainingAmount: item.amount,
          dueDate: item.dueDate,
          paid: false,
          status: LoanInstallmentStatus.PENDING,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          observations: null,
          lastPaymentAt: null,
          paymentDate: null,
        });

        await manager.save(installment);
      }

      const movement = manager.create(LoanFundMovement, {
        type: LoanFundMovementType.LOAN_GRANTED,
        amount: -values.requestedAmount,
        loanId: savedLoan.id,
        paymentId: null,
        description: `Préstamo otorgado a ${savedLoan.clientName}`,
      });

      await manager.save(movement);

      return savedLoan;
    });
  }

  async findAll() {
    return this.loansRepo.find({
      relations: ['client', 'installments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const loan = await this.loansRepo.findOne({
      where: { id },
      relations: ['client', 'installments', 'installments.payments'],
    });

    if (!loan) throw new NotFoundException('Préstamo no encontrado.');

    return loan;
  }

  async getFundSummary() {
    const availableFund = await this.getAvailableFund();

    const movements = await this.fundMovementsRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      initialFund: this.INITIAL_FUND,
      availableFund,
      movements,
    };
  }

  async refreshLoanStatus(loanId: number) {
    const loan = await this.loansRepo.findOne({
      where: { id: loanId },
      relations: ['installments'],
    });

    if (!loan) return;

    const allPaid =
      loan.installments?.length > 0 &&
      loan.installments.every((i) => i.paid === true);

    if (allPaid && loan.status !== LoanStatus.PAID) {
      loan.status = LoanStatus.PAID;
      await this.loansRepo.save(loan);
    }
  }

  async getPdf(id: number): Promise<Buffer> {
    const loan = await this.findOne(id);

    const dir = path.join(__dirname, '../../uploads/loans', String(loan.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `prestamo_${loan.id}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    try {
      const logoPath = path.join(__dirname, '../../logos/LogobynKairos.jpg');
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

    doc.fontSize(22).fillColor('#1e1e1e').text('Kairos Capital', {
      align: 'center',
    });
    doc.fontSize(12).fillColor('#555').text('Comprobante de Préstamo', {
      align: 'center',
    });
    doc.fontSize(10).fillColor('#777').text(
      `Emitido el ${new Date().toLocaleDateString('es-AR')}`,
      { align: 'center' },
    );

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
    doc.moveDown(1);

    const sectionTitle = (title: string) => {
      doc.moveDown(0.6);
      doc
        .fontSize(13)
        .fillColor('#009879')
        .text(title.toUpperCase(), { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#1e1e1e');
    };

    sectionTitle('Datos del Préstamo');
    doc.text(`Número: ${loan.id}`);
    doc.text(`Fecha de solicitud: ${this.formatDateAr(loan.requestDate)}`);
    doc.text(`Estado: ${loan.status}`);

    sectionTitle('Cliente');
    doc.text(`Nombre: ${loan.clientName}`);
    if (loan.clientCuitCuil) doc.text(`CUIT/CUIL: ${loan.clientCuitCuil}`);
    if (loan.clientDni) doc.text(`DNI: ${loan.clientDni}`);

    if (loan.client?.workAddress) {
      doc.text(`Dirección laboral: ${loan.client.workAddress}`);
    }

    if (loan.client?.aliasOrCbu) {
      doc.text(`Alias/CBU: ${loan.client.aliasOrCbu}`);
    }

    sectionTitle('Detalle de Cuotas');

    const ordered = [...(loan.installments ?? [])].sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    for (const inst of ordered) {
      doc.text(
        `Cuota ${inst.installmentNumber}/${inst.totalInstallments} - Vence ${this.formatDateAr(
          inst.dueDate,
        )} - ${this.formatPesos(Number(inst.amount))}`,
      );
    }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(1);

    sectionTitle('Condiciones del Préstamo');

    doc
      .fontSize(8.5)
      .fillColor('#555')
      .text(
        `El cliente se compromete a realizar el pago semanal del préstamo. En caso de retraso, se aplicará un ${Number(loan.dailyLateInterestRate)}% de interés diario sobre el saldo pendiente.`,
        { align: 'justify', lineGap: 2.5 },
      );

    doc.end();

    const pdfBuffer = await done;
    fs.writeFileSync(filePath, pdfBuffer);

    return pdfBuffer;
  }
}