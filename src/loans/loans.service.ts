import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

@Injectable()
export class LoansService {
  private readonly INITIAL_FUND = 5000000;
  private readonly MONTHLY_INTEREST_PERCENT = 60;
  private readonly DAILY_LATE_INTEREST_PERCENT = 5;

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

  calculateLoanValues(requestedAmount: number, weeklyInstallments: number) {
    const amount = Number(requestedAmount);
    const installments = Number(weeklyInstallments);

    if (!amount || amount <= 0) {
      throw new BadRequestException('El monto solicitado debe ser mayor a 0.');
    }

    if (!installments || installments < 1 || installments > 6) {
      throw new BadRequestException(
        'La cantidad de cuotas semanales debe estar entre 1 y 6.',
      );
    }

    const interestAmount = +(amount * 0.6 * (installments / 4)).toFixed(2);
    const totalToReturn = +(amount + interestAmount).toFixed(2);
    const installmentAmount = +(totalToReturn / installments).toFixed(2);

    return {
      requestedAmount: amount,
      weeklyInstallments: installments,
      monthlyInterestRate: this.MONTHLY_INTEREST_PERCENT,
      dailyLateInterestRate: this.DAILY_LATE_INTEREST_PERCENT,
      interestAmount,
      totalToReturn,
      installmentAmount,
    };
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
  ) {
    const base = this.parseLocalDate(requestDate);

    return Array.from({ length: weeklyInstallments }).map((_, index) => {
      const due = new Date(base);
      due.setDate(base.getDate() + 7 * (index + 1));

      return {
        installmentNumber: index + 1,
        totalInstallments: weeklyInstallments,
        amount: installmentAmount,
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
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        requestedAmount: values.requestedAmount,
        interestAmount: values.interestAmount,
        totalToReturn: values.totalToReturn,
        installmentAmount: values.installmentAmount,
        requestDate: dto.requestDate,
        weeklyInstallments: values.weeklyInstallments,
        monthlyInterestRate: values.monthlyInterestRate,
        dailyLateInterestRate: values.dailyLateInterestRate,
        status: LoanStatus.ACTIVE,
      });

      const savedLoan = await manager.save(loan);

      const installmentPreview = this.buildInstallmentPreview(
        dto.requestDate,
        values.weeklyInstallments,
        values.installmentAmount,
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
      const logoPath = path.join(__dirname, '../../logos/EbenezerLogoByN.png');
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

    doc.fontSize(22).fillColor('#1e1e1e').text('Ebenezer Capital', {
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
    doc.text(`CUIT/CUIL: ${loan.clientCuitCuil}`);

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
        'El cliente se compromete a hacer el pago semanal del préstamo. El interés crediticio aplicado es del 60% mensual. En caso de retraso en el pago, se aplicará un 5% de interés diario adicional sobre el saldo pendiente.',
        { align: 'justify', lineGap: 2.5 },
      );

    doc.end();

    const pdfBuffer = await done;
    fs.writeFileSync(filePath, pdfBuffer);

    return pdfBuffer;
  }
}