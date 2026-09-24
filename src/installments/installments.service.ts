import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import {
  Installment,
  InstallmentReceiver,
  InstallmentStatus,
} from './installment.entity';
import { Sale } from '../sales/sale.entity';
import { Client } from '../clients/entities/client.entity';
import { InstallmentPayment } from '../installment-payments/installment-payment.entity';
import { TreasuryService } from '../treasury/treasury.service';
import { TreasuryCompany, TreasuryMovementType, TreasuryPaymentMethod } from '../treasury/treasury.enums';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,

    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,

    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,

    @InjectRepository(InstallmentPayment)
    private readonly installmentPaymentsRepository: Repository<InstallmentPayment>,
    private readonly dataSource: DataSource,
    private readonly treasuryService: TreasuryService,
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

  private getArgentinaToday(date: Date = new Date()): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);

    return new Date(year, month - 1, day);
  }

  private getInterestStartDate(inst: Installment): Date | null {
    if (!inst.dueDate) return null;

    if (
      inst.status === InstallmentStatus.PARTIALLY_PAID &&
      inst.lastPaymentAt
    ) {
      return this.parseLocalDate(inst.lastPaymentAt);
    }

    return this.parseLocalDate(inst.dueDate);
  }

  private getCurrentAmount(inst: Installment, asOf: Date = new Date()): number {
    const baseRaw =
      inst.remainingAmount != null ? inst.remainingAmount : inst.amount;
    const base = Number(baseRaw);

    if (!inst.dueDate) return +base.toFixed(2);
    if (inst.paid) return +base.toFixed(2);

    const today = this.getArgentinaToday(asOf);
    const interestStartDate = this.getInterestStartDate(inst);

    if (!interestStartDate) return +base.toFixed(2);

    today.setHours(0, 0, 0, 0);
    interestStartDate.setHours(0, 0, 0, 0);

    if (today <= interestStartDate) {
      return +base.toFixed(2);
    }

    const diffMs = today.getTime() - interestStartDate.getTime();
    const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) return +base.toFixed(2);

    const amountWithInterest = base * (1 + 0.01 * daysLate);
    return +amountWithInterest.toFixed(2);
  }

  async findAll() {
    const installments = await this.installmentsRepository.find({
      where: {
        concept: In(['PERSONAL_FINANCING', 'MOTO_PLAN']),
        isJudicialized: false,
      },
      relations: [
        'sale',
        'sale.client',
        'sale.installments',
        'sale.vehicle',
        'payments',
        'client',
      ],
      order: { dueDate: 'ASC' },
    });

    const labelByInstallmentId = new Map<number, string>();
    const bySaleAndConcept = new Map<string, any[]>();

    for (const inst of installments as any[]) {
      const sid = inst.sale?.id;
      const concept = inst.concept || 'UNKNOWN';
      if (!sid) continue;

      const key = `${sid}-${concept}`;
      if (!bySaleAndConcept.has(key)) bySaleAndConcept.set(key, []);
      bySaleAndConcept.get(key)!.push(inst);
    }

    for (const [, list] of bySaleAndConcept.entries()) {
      const ordered = [...list].sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
      const total = ordered.length;

      ordered.forEach((inst: any, idx: number) => {
        labelByInstallmentId.set(inst.id, `${idx + 1}/${total}`);
        inst.installmentNumber = idx + 1;
        inst.totalInstallments = total;
      });
    }

    const today = this.getArgentinaToday();

    return installments.map((inst: any) => {
      const currentAmount = this.getCurrentAmount(inst, today);

      let isOverdue = false;
      if (inst.dueDate && !inst.paid) {
        const dToday = this.getArgentinaToday(today);
        const due = this.parseLocalDate(inst.dueDate);

        dToday.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        isOverdue = dToday > due;
      }

      const client = inst.client ?? inst.sale?.client ?? null;
      const vehicle = inst.sale?.vehicle ?? null;

      const paymentsArr = Array.isArray(inst.payments)
        ? [...inst.payments]
        : [];

      paymentsArr.sort((a: any, b: any) => {
        const da = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
        const db = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;

        if (da !== db) return da - db;
        return (a.id ?? 0) - (b.id ?? 0);
      });

      const payment =
        paymentsArr.length > 0 ? paymentsArr[paymentsArr.length - 1] : null;

      return {
        id: inst.id,
        installmentLabel: labelByInstallmentId.get(inst.id) ?? null,
        amount: Number(inst.amount),
        remainingAmount:
          inst.remainingAmount != null
            ? Number(inst.remainingAmount)
            : Number(inst.amount),
        currentAmount,
        paid: inst.paid === true,
        status: inst.status,
        isOverdue,
        isJudicialized: inst.isJudicialized === true,

dueDate: inst.dueDate,
lastPaymentAt: inst.lastPaymentAt,
paymentDate: inst.paymentDate,
saleId: inst.sale?.id ?? null,

        client: client
          ? {
              firstName: client.firstName,
              lastName: client.lastName,
              dni: client.dni,
            }
          : null,

        vehicle: vehicle
          ? {
              id: vehicle.id,
              plate: vehicle.plate,
              brand: vehicle.brand,
              model: vehicle.model,
              versionName: vehicle.versionName,
              year: vehicle.year,
              color: vehicle.color,
            }
          : null,

        payment,
        payments: paymentsArr,

        concept: inst.concept,
        receiver: inst.receiver,
        observations: inst.observations,
      };
    });
  }

  async findOne(id: number) {
    const inst = await this.installmentsRepository.findOne({
      where: { id },
      relations: ['sale', 'sale.client', 'payments', 'sale.vehicle', 'client'],
    });

    if (!inst) throw new NotFoundException('Installment not found');
    return inst;
  }

  async applyPaymentToInstallment(
    id: number,
    amount: number,
    paymentDate: string,
    receiver: InstallmentReceiver,
    observations?: string,
    treasuryAccountId?: number,
    treasuryPaymentMethod?: TreasuryPaymentMethod,
    userId?: number,
  ) {
    const inst = await this.installmentsRepository.findOne({
      where: { id },
      relations: ['sale', 'sale.client', 'payments', 'client'],
    });

    if (!inst) {
      throw new NotFoundException(`Installment ${id} not found`);
    }

    if (inst.isJudicialized) {
      throw new BadRequestException(
        'La cuota está judicializada y no puede recibir pagos por esta vía.',
      );
    }

    if (!treasuryAccountId || !treasuryPaymentMethod || !userId) throw new BadRequestException('Debe indicar cuenta y medio de cobro para Tesorería.');

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a 0.');
    }

    const basePrincipal =
      inst.remainingAmount != null
        ? Number(inst.remainingAmount)
        : Number(inst.amount);

    if (basePrincipal <= 0) {
      throw new BadRequestException(
        'La cuota no tiene saldo pendiente para pagar.',
      );
    }

    const effectiveDate = paymentDate
      ? this.parseLocalDate(paymentDate)
      : this.getArgentinaToday();

    const interestStartDate = this.getInterestStartDate(inst);
    let daysLate = 0;

    if (interestStartDate) {
      const paymentRef = new Date(effectiveDate);
      const dStart = new Date(interestStartDate);

      paymentRef.setHours(0, 0, 0, 0);
      dStart.setHours(0, 0, 0, 0);

      if (paymentRef > dStart) {
        const diffMs = paymentRef.getTime() - dStart.getTime();
        daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    const factor = 1 + 0.01 * daysLate;

    const currentAmount = +(
      factor > 1 ? basePrincipal * factor : basePrincipal
    ).toFixed(2);

    if (payAmount > currentAmount + 0.01) {
      throw new BadRequestException(
        `El monto a pagar ($${payAmount.toFixed(
          2,
        )}) no puede superar el valor actual de la cuota ($${currentAmount.toFixed(
          2,
        )}).`,
      );
    }

    if (observations && observations.trim().length > 0) {
      const prefix = inst.observations ? inst.observations + '\n' : '';
      inst.observations = prefix + observations.trim();
    }

    inst.receiver = receiver;
    inst.lastPaymentAt = effectiveDate;

    if (payAmount >= currentAmount - 0.01) {
      inst.remainingAmount = 0;
      inst.paid = true;
      inst.status = InstallmentStatus.PAID;
      inst.paymentDate = effectiveDate;
} else {
  // 🔥 Nueva lógica:
  // remainingAmount representa la deuda real al momento del último pago,
  // no capital puro.

  const newBalance = currentAmount - payAmount;

  inst.remainingAmount = +Math.max(newBalance, 0).toFixed(2);
  inst.paid = false;
  inst.status = InstallmentStatus.PARTIALLY_PAID;
  inst.paymentDate = null;
}

    return this.dataSource.transaction(async (manager) => {
      const savedInst = await manager.save(inst);
      const payment = manager.create(InstallmentPayment, { installmentId: inst.id, amount: payAmount, paymentDate });
      const savedPayment = await manager.save(payment);
      const client = inst.client ?? inst.sale?.client ?? null;
      const clientName = client ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() : null;

      await this.treasuryService.createAutomaticMovement(manager, {
        company: TreasuryCompany.GL_MOTORS, type: TreasuryMovementType.INCOME,
        movementDate: paymentDate, amount: payAmount, accountId: treasuryAccountId,
        paymentMethod: treasuryPaymentMethod,
        description: `Cobro financiación GL - venta #${inst.sale?.id ?? '-'}`,
        sourceType: 'GL_INSTALLMENT_PAYMENT', sourceId: savedPayment.id, createdBy: userId,
        reference: `Pago cuota #${savedPayment.id}`, counterparty: clientName,
        installmentId: inst.id, paymentId: savedPayment.id, saleId: inst.sale?.id ?? null,
        clientId: client?.id ?? null,
      });

      return { id: savedInst.id, paid: savedInst.paid, status: savedInst.status,
        remainingAmount: savedInst.remainingAmount, paymentId: savedPayment.id };
    });
  }

  async markAsPaid(id: number) {
    const inst = await this.findOne(id);

    inst.paid = true;
    inst.status = InstallmentStatus.PAID;
    inst.remainingAmount = 0;
    inst.paymentDate = new Date();

    await this.installmentsRepository.save(inst);
    return { message: `Installment ${id} marked as paid.` };
  }

  async markAsUnpaid(id: number) {
    const inst = await this.findOne(id);

    inst.paid = false;
    inst.status = InstallmentStatus.PENDING;
    inst.remainingAmount = inst.amount;
    inst.paymentDate = null;

    await this.installmentsRepository.save(inst);
    return { message: `Installment ${id} reverted to pending.` };
  }

  async remove(id: number) {
    const inst = await this.findOne(id);
    await this.installmentsRepository.remove(inst);
    return { message: `Installment ${id} deleted.` };
  }
}