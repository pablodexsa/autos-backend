import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  LoanInstallment,
  LoanInstallmentStatus,
} from './loan-installment.entity';
import { LoanInstallmentPayment } from '../loan-installment-payments/loan-installment-payment.entity';
import {
  LoanFundMovement,
  LoanFundMovementType,
} from '../loans/loan-fund-movement.entity';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class LoanInstallmentsService {
  constructor(
    @InjectRepository(LoanInstallment)
    private readonly installmentsRepo: Repository<LoanInstallment>,

    @InjectRepository(LoanInstallmentPayment)
    private readonly paymentsRepo: Repository<LoanInstallmentPayment>,

    @InjectRepository(LoanFundMovement)
    private readonly fundMovementsRepo: Repository<LoanFundMovement>,

    private readonly dataSource: DataSource,

    @Inject(forwardRef(() => LoansService))
    private readonly loansService: LoansService,
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

private getInterestStartDate(inst: LoanInstallment): Date | null {
  if (!inst.dueDate) return null;

  const dueDate = this.parseLocalDate(inst.dueDate);

  if (
    inst.status === LoanInstallmentStatus.PARTIALLY_PAID &&
    inst.lastPaymentAt
  ) {
    const lastPaymentDate = this.parseLocalDate(inst.lastPaymentAt);

    dueDate.setHours(0, 0, 0, 0);
    lastPaymentDate.setHours(0, 0, 0, 0);

    // Si el pago parcial fue antes del vencimiento,
    // la mora debe empezar desde el vencimiento, no desde el pago.
    if (lastPaymentDate > dueDate) {
      return lastPaymentDate;
    }
  }

  return dueDate;
}

  private getCurrentAmount(
    inst: LoanInstallment,
    asOf: Date = new Date(),
  ): number {
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

    const amountWithInterest = base * (1 + 0.05 * daysLate);
    return +amountWithInterest.toFixed(2);
  }

  async findAll() {
    const installments = await this.installmentsRepo.find({
      relations: ['loan', 'loan.client', 'client', 'payments'],
      order: { dueDate: 'ASC' },
    });

    const today = this.getArgentinaToday();

    return installments.map((inst) => {
      const currentAmount = this.getCurrentAmount(inst, today);

      const dToday = this.getArgentinaToday(today);
      const due = this.parseLocalDate(inst.dueDate);

      dToday.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);

      const isOverdue = !inst.paid && dToday > due;

      const payments = Array.isArray(inst.payments) ? [...inst.payments] : [];

      payments.sort((a: any, b: any) => {
        const da = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
        const db = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;

        if (da !== db) return da - db;
        return (a.id ?? 0) - (b.id ?? 0);
      });

      const paidAmount = payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount || 0),
        0,
      );

      const remainingAmount =
        inst.remainingAmount != null
          ? Number(inst.remainingAmount)
          : Number(inst.amount);

      return {
        id: inst.id,
        loanId: inst.loanId,
        installmentLabel: `${inst.installmentNumber}/${inst.totalInstallments}`,
        amount: Number(inst.amount),
        remainingAmount,
        paidAmount: +paidAmount.toFixed(2),
        currentAmount,
        paid: inst.paid === true,
        status: inst.status,
        isOverdue,
        dueDate: inst.dueDate,
        lastPaymentAt: inst.lastPaymentAt,
        paymentDate: inst.paymentDate,
        client: inst.client
          ? {
              id: inst.client.id,
              firstName: inst.client.firstName,
              lastName: inst.client.lastName,
              cuitCuil: inst.client.cuitCuil,
            }
          : null,
        loan: inst.loan
          ? {
              id: inst.loan.id,
              requestedAmount: Number(inst.loan.requestedAmount),
              totalToReturn: Number(inst.loan.totalToReturn),
              requestDate: inst.loan.requestDate,
            }
          : null,
        payment: payments.length ? payments[payments.length - 1] : null,
        payments,
        observations: inst.observations,
      };
    });
  }

  async findOne(id: number) {
    const inst = await this.installmentsRepo.findOne({
      where: { id },
      relations: ['loan', 'loan.client', 'client', 'payments'],
    });

    if (!inst) throw new NotFoundException('Cuota de préstamo no encontrada.');

    return inst;
  }

  async applyPaymentToInstallment(
    id: number,
    amount: number,
    paymentDate: string,
    observations?: string,
  ) {
    const inst = await this.installmentsRepo.findOne({
      where: { id },
      relations: ['loan', 'client', 'payments'],
    });

    if (!inst) {
      throw new NotFoundException(`Cuota de préstamo ${id} no encontrada.`);
    }

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

    const factor = 1 + 0.05 * daysLate;

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

    return this.dataSource.transaction(async (manager) => {
      if (observations && observations.trim().length > 0) {
        const prefix = inst.observations ? inst.observations + '\n' : '';
        inst.observations = prefix + observations.trim();
      }

      inst.lastPaymentAt = effectiveDate;

      if (payAmount >= currentAmount - 0.01) {
        inst.remainingAmount = 0;
        inst.paid = true;
        inst.status = LoanInstallmentStatus.PAID;
        inst.paymentDate = effectiveDate;
      } else {
        const newBalance = currentAmount - payAmount;

        inst.remainingAmount = +Math.max(newBalance, 0).toFixed(2);
        inst.paid = false;
        inst.status = LoanInstallmentStatus.PARTIALLY_PAID;
        inst.paymentDate = null;
      }

      const savedInst = await manager.save(inst);

      const payment = manager.create(LoanInstallmentPayment, {
        installmentId: inst.id,
        installment: inst,
        loanId: inst.loanId,
        loan: inst.loan,
        clientId: inst.clientId,
        client: inst.client,
        amount: payAmount,
        paymentDate,
        receiptPath: null,
        isPaid: true,
      });

      const savedPayment = await manager.save(payment);

      const movement = manager.create(LoanFundMovement, {
        type: LoanFundMovementType.PAYMENT_RECEIVED,
        amount: payAmount,
        loanId: inst.loanId,
        paymentId: savedPayment.id,
        description: `Pago recibido de cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
      });

      await manager.save(movement);

      await this.loansService.refreshLoanStatus(inst.loanId);

      return {
        id: savedInst.id,
        paid: savedInst.paid,
        status: savedInst.status,
        remainingAmount: savedInst.remainingAmount,
        paymentId: savedPayment.id,
      };
    });
  }
}