import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
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
import { Loan } from '../loans/loan.entity';
import { LoanProductType } from '../loans/loan-product.enum';
import {
  CashBoxMovement,
  CashBoxMovementType,
  CashBoxType,
} from '../cash-box-movements/cash-box-movement.entity';

@Injectable()
export class LoanInstallmentsService {
  constructor(
    @InjectRepository(LoanInstallment)
    private readonly installmentsRepo: Repository<LoanInstallment>,

    @InjectRepository(LoanInstallmentPayment)
    private readonly paymentsRepo: Repository<LoanInstallmentPayment>,

    @InjectRepository(LoanFundMovement)
    private readonly fundMovementsRepo: Repository<LoanFundMovement>,

    @InjectRepository(CashBoxMovement)
    private readonly cashBoxMovementsRepo: Repository<CashBoxMovement>,

    private readonly dataSource: DataSource,

    @Inject(forwardRef(() => LoansService))
    private readonly loansService: LoansService,
  ) {}

  private money(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

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
      if (lastPaymentDate > dueDate) return lastPaymentDate;
    }

    return dueDate;
  }

  private calculateLateFee(
    inst: LoanInstallment,
    baseAmount: number,
    effectiveDate: Date,
  ): { daysLate: number; lateFeeAmount: number } {
    const interestStartDate = this.getInterestStartDate(inst);
    if (!interestStartDate) return { daysLate: 0, lateFeeAmount: 0 };

    const paymentRef = new Date(effectiveDate);
    const start = new Date(interestStartDate);
    paymentRef.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    if (paymentRef <= start) return { daysLate: 0, lateFeeAmount: 0 };

    const daysLate = Math.floor(
      (paymentRef.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const rate = Number(inst.loan?.dailyLateInterestRate ?? 0) / 100;
    return {
      daysLate,
      lateFeeAmount: this.money(baseAmount * rate * daysLate),
    };
  }

  private getCurrentAmount(inst: LoanInstallment, asOf: Date = new Date()): number {
    const base = Number(
      inst.remainingAmount != null ? inst.remainingAmount : inst.amount,
    );
    if (!inst.dueDate || inst.paid) return this.money(base);
    const today = this.getArgentinaToday(asOf);
    const { lateFeeAmount } = this.calculateLateFee(inst, base, today);
    return this.money(base + lateFeeAmount);
  }

  /**
   * Distribuye la parte contractual del pago según la composición económica
   * original del préstamo. La última diferencia de centavos queda en interés.
   */
  private splitContractualPayment(
    loan: Loan,
    contractualPaid: number,
  ): { principal: number; expense: number; interest: number } {
    const total = Number(loan.totalToReturn);
    if (total <= 0 || contractualPaid <= 0) {
      return { principal: 0, expense: 0, interest: 0 };
    }

    const principal = this.money(
      contractualPaid * (Number(loan.requestedAmount) / total),
    );
    const expense = this.money(
      contractualPaid * (Number(loan.expensesAmount ?? 0) / total),
    );
    const interest = this.money(contractualPaid - principal - expense);

    return { principal, expense, interest };
  }

  private async saveMovement(
    manager: EntityManager,
    data: Partial<CashBoxMovement>,
  ) {
    const amount = this.money(Number(data.amount ?? 0));
    if (Math.abs(amount) < 0.005) return;
    await manager.save(
      manager.create(CashBoxMovement, {
        principalAmount: 0,
        interestAmount: 0,
        expenseAmount: 0,
        lateFeeAmount: 0,
        ...data,
        amount,
      }),
    );
  }

  private async createKairosStandardMovements(
    manager: EntityManager,
    inst: LoanInstallment,
    payment: LoanInstallmentPayment,
  ) {
    const common = {
      loanId: inst.loanId,
      installmentId: inst.id,
      paymentId: payment.id,
      saleId: inst.loan.sourceSaleId ?? null,
    };

    // Capital real recuperado: 100% Caja Kairos.
    await this.saveMovement(manager, {
      ...common,
      boxType: CashBoxType.KAIROS,
      movementType: CashBoxMovementType.PRINCIPAL_RECOVERY,
      amount: payment.principalAmount,
      principalAmount: payment.principalAmount,
      description: `Recupero de capital cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
    });

    // Gasto de otorgamiento: 100% Gerencia.
    await this.saveMovement(manager, {
      ...common,
      boxType: CashBoxType.MANAGEMENT,
      movementType: CashBoxMovementType.GRANT_EXPENSE,
      amount: payment.expenseAmount,
      expenseAmount: payment.expenseAmount,
      description: `Recupero gasto de otorgamiento cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
    });

    // Interés y mora: 25/75 Gerencia, 5/75 Logística, 45/75 Kairos.
    for (const component of [
      {
        value: Number(payment.interestAmount),
        type: CashBoxMovementType.INTEREST_ALLOCATION,
        field: 'interestAmount' as const,
        label: 'interés',
      },
      {
        value: Number(payment.lateFeeAmount),
        type: CashBoxMovementType.LATE_FEE_ALLOCATION,
        field: 'lateFeeAmount' as const,
        label: 'mora',
      },
    ]) {
      if (component.value <= 0) continue;

      const management = this.money(component.value * (25 / 75));
      const logistics = this.money(component.value * (5 / 75));
      const kairos = this.money(component.value - management - logistics);

      for (const row of [
        { boxType: CashBoxType.MANAGEMENT, amount: management },
        { boxType: CashBoxType.LOGISTICS, amount: logistics },
        { boxType: CashBoxType.KAIROS, amount: kairos },
      ]) {
        await this.saveMovement(manager, {
          ...common,
          boxType: row.boxType,
          movementType: component.type,
          amount: row.amount,
          [component.field]: row.amount,
          description: `Distribución de ${component.label} cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
        });
      }
    }
  }

  private async createGlMotorsMovements(
    manager: EntityManager,
    inst: LoanInstallment,
    payment: LoanInstallmentPayment,
  ) {
    const common = {
      loanId: inst.loanId,
      installmentId: inst.id,
      paymentId: payment.id,
      saleId: inst.loan.sourceSaleId ?? null,
    };

    // Gerencia recibe 10% de todo lo efectivamente pagado, incluida la mora.
    const managementCommission = this.money(Number(payment.amount) * 0.1);

    // Caja GL Motors recupera el capital contractual pagado.
    const principalRecovery = this.money(Number(payment.principalAmount));

    // El remanente económico queda en Caja Kairos.
    // Equivale a interés + mora - comisión de Gerencia.
    const kairosIncome = this.money(
      Number(payment.amount) - managementCommission - principalRecovery,
    );

    await this.saveMovement(manager, {
      ...common,
      boxType: CashBoxType.MANAGEMENT,
      movementType: CashBoxMovementType.MANAGEMENT_COMMISSION,
      amount: managementCommission,
      interestAmount: this.money(
        Math.min(managementCommission, Number(payment.interestAmount)),
      ),
      lateFeeAmount: this.money(
        Math.max(
          managementCommission - Number(payment.interestAmount),
          0,
        ),
      ),
      description: `Comisión Gerencia 10% cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
    });

    await this.saveMovement(manager, {
      ...common,
      boxType: CashBoxType.GL_MOTORS,
      movementType: CashBoxMovementType.PRINCIPAL_RECOVERY,
      amount: principalRecovery,
      principalAmount: principalRecovery,
      description: `Recupero de capital GL Motors cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
    });

    await this.saveMovement(manager, {
      ...common,
      boxType: CashBoxType.KAIROS,
      movementType: CashBoxMovementType.INTEREST_ALLOCATION,
      amount: kairosIncome,
      interestAmount: this.money(Number(payment.interestAmount)),
      lateFeeAmount: this.money(Number(payment.lateFeeAmount)),
      description: `Ingreso neto Kairos GL Motors cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
    });
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
        return da !== db ? da - db : (a.id ?? 0) - (b.id ?? 0);
      });
      const paidAmount = payments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0,
      );
      const remainingAmount = Number(
        inst.remainingAmount != null ? inst.remainingAmount : inst.amount,
      );

      return {
        id: inst.id,
        loanId: inst.loanId,
        installmentLabel: `${inst.installmentNumber}/${inst.totalInstallments}`,
        amount: Number(inst.amount),
        remainingAmount,
        paidAmount: this.money(paidAmount),
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
              productType: inst.loan.productType,
              requestedAmount: Number(inst.loan.requestedAmount),
              totalToReturn: Number(inst.loan.totalToReturn),
              requestDate: inst.loan.requestDate,
	      dailyLateInterestRate: Number(inst.loan.dailyLateInterestRate),
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

    const payAmount = this.money(Number(amount));
    if (!payAmount || payAmount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a 0.');
    }

    const contractualBalance = this.money(
      Number(inst.remainingAmount != null ? inst.remainingAmount : inst.amount),
    );
    if (contractualBalance <= 0) {
      throw new BadRequestException('La cuota no tiene saldo pendiente para pagar.');
    }

    const effectiveDate = paymentDate
      ? this.parseLocalDate(paymentDate)
      : this.getArgentinaToday();
    const { daysLate, lateFeeAmount } = this.calculateLateFee(
      inst,
      contractualBalance,
      effectiveDate,
    );
    const currentAmount = this.money(contractualBalance + lateFeeAmount);

    if (payAmount > currentAmount + 0.01) {
      throw new BadRequestException(
        `El monto a pagar ($${payAmount.toFixed(2)}) no puede superar el valor actual de la cuota ($${currentAmount.toFixed(2)}).`,
      );
    }

    // Se cobra primero la mora vencida y luego la parte contractual.
    const lateFeePaid = this.money(Math.min(payAmount, lateFeeAmount));
    const contractualPaid = this.money(
      Math.min(Math.max(payAmount - lateFeePaid, 0), contractualBalance),
    );
    const split = this.splitContractualPayment(inst.loan, contractualPaid);

    return this.dataSource.transaction(async (manager) => {
      if (observations?.trim()) {
        const prefix = inst.observations ? `${inst.observations}\n` : '';
        inst.observations = prefix + observations.trim();
      }

      inst.lastPaymentAt = effectiveDate;
      const newBalance = this.money(currentAmount - payAmount);
      if (newBalance <= 0.01) {
        inst.remainingAmount = 0;
        inst.paid = true;
        inst.status = LoanInstallmentStatus.PAID;
        inst.paymentDate = effectiveDate;
      } else {
        // Mantiene la compatibilidad actual: toda deuda impaga queda en el saldo
        // y la mora futura comienza desde este pago parcial.
        inst.remainingAmount = newBalance;
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
        principalAmount: split.principal,
        expenseAmount: split.expense,
        interestAmount: split.interest,
        lateFeeAmount: lateFeePaid,
        paymentDate: this.toDateOnlyString(effectiveDate),
        receiptPath: null,
        isPaid: true,
      });
      const savedPayment = await manager.save(payment);

      await manager.save(
        manager.create(LoanFundMovement, {
          type: LoanFundMovementType.PAYMENT_RECEIVED,
          amount: payAmount,
          loanId: inst.loanId,
          paymentId: savedPayment.id,
          description: `Pago recibido de cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
        }),
      );

      if (inst.loan.productType === LoanProductType.GL_MOTORS) {
        await this.createGlMotorsMovements(manager, inst, savedPayment);
      } else {
        await this.createKairosStandardMovements(manager, inst, savedPayment);
      }

      await this.loansService.refreshLoanStatus(inst.loanId);

      return {
        id: savedInst.id,
        paid: savedInst.paid,
        status: savedInst.status,
        remainingAmount: savedInst.remainingAmount,
        paymentId: savedPayment.id,
        daysLate,
        breakdown: {
          principalAmount: savedPayment.principalAmount,
          expenseAmount: savedPayment.expenseAmount,
          interestAmount: savedPayment.interestAmount,
          lateFeeAmount: savedPayment.lateFeeAmount,
        },
      };
    });
  }
}
