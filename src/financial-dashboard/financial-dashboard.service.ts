import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Loan, LoanStatus } from '../loans/loan.entity';
import { LoanProductType } from '../loans/loan-product.enum';
import { LoanInstallment, LoanInstallmentStatus } from '../loan-installments/loan-installment.entity';
import { LoanInstallmentPayment } from '../loan-installment-payments/loan-installment-payment.entity';
import { CashBoxMovement, CashBoxType } from '../cash-box-movements/cash-box-movement.entity';

@Injectable()
export class FinancialDashboardService {
  private readonly timezone = 'America/Argentina/Buenos_Aires';

  constructor(
    @InjectRepository(Loan) private readonly loansRepo: Repository<Loan>,
    @InjectRepository(LoanInstallment) private readonly installmentsRepo: Repository<LoanInstallment>,
    @InjectRepository(LoanInstallmentPayment) private readonly paymentsRepo: Repository<LoanInstallmentPayment>,
    @InjectRepository(CashBoxMovement) private readonly movementsRepo: Repository<CashBoxMovement>,
  ) {}

  private round(value: number) {
    return Number((Number(value) || 0).toFixed(2));
  }

  private todayIso(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
  }

  private parseIso(value: string) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  private iso(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private ranges(reference: string) {
    const current = this.parseIso(reference);
    const day = current.getDay();
    const monday = new Date(current);
    monday.setDate(current.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1, 12);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12);
    return {
      today: { from: reference, to: reference },
      week: { from: this.iso(monday), to: this.iso(sunday) },
      month: { from: this.iso(monthStart), to: this.iso(monthEnd) },
    };
  }

  private sum<T>(items: T[], selector: (item: T) => number) {
    return this.round(items.reduce((acc, item) => acc + Number(selector(item) || 0), 0));
  }

  async getSummary(referenceDate?: string) {
    const reference = referenceDate || this.todayIso();
    const period = this.ranges(reference);

    const [loans, installments, payments, movements] = await Promise.all([
      this.loansRepo.find({ where: { status: In([LoanStatus.ACTIVE, LoanStatus.PAID]) } }),
      this.installmentsRepo.find({ relations: ['loan', 'client'] }),
      this.paymentsRepo.find({ where: { isPaid: true }, relations: ['loan', 'installment', 'client'] }),
      this.movementsRepo.find({ order: { createdAt: 'ASC' } }),
    ]);

    const activeLoans = loans.filter((l) => l.status === LoanStatus.ACTIVE);
    const pendingInstallments = installments.filter((i) => i.status !== LoanInstallmentStatus.PAID);
    const overdue = pendingInstallments.filter((i) => i.dueDate < reference);

    const paidIn = (from: string, to: string) => payments.filter((p) => p.paymentDate >= from && p.paymentDate <= to);
    const todayPayments = paidIn(period.today.from, period.today.to);
    const weekPayments = paidIn(period.week.from, period.week.to);
    const monthPayments = paidIn(period.month.from, period.month.to);

    const boxBalances: Record<CashBoxType, number> = {
      [CashBoxType.KAIROS]: 0,
      [CashBoxType.GL_MOTORS]: 0,
      [CashBoxType.MANAGEMENT]: 0,
      [CashBoxType.LOGISTICS]: 0,
    };
    for (const movement of movements) {
      boxBalances[movement.boxType] = this.round(boxBalances[movement.boxType] + Number(movement.amount));
    }

    const byProduct = (productType: LoanProductType) => {
      const productLoans = loans.filter((l) => l.productType === productType);
      const ids = new Set(productLoans.map((l) => l.id));
      const productPayments = payments.filter((p) => ids.has(p.loanId));
      const productPending = pendingInstallments.filter((i) => ids.has(i.loanId));
      return {
        loanCount: productLoans.length,
        activeLoanCount: productLoans.filter((l) => l.status === LoanStatus.ACTIVE).length,
        principalPlaced: this.sum(productLoans, (l) => Number(l.requestedAmount)),
        principalRecovered: this.sum(productPayments, (p) => Number(p.principalAmount)),
        principalOutstanding: this.sum(productPending, (i) => Number(i.remainingAmount ?? i.amount)),
        interestCollected: this.sum(productPayments, (p) => Number(p.interestAmount)),
        lateFeesCollected: this.sum(productPayments, (p) => Number(p.lateFeeAmount)),
      };
    };

    const weeklySeries = Array.from({ length: 8 }, (_, index) => {
      const end = this.parseIso(period.week.to);
      end.setDate(end.getDate() - (7 * (7 - index)));
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const from = this.iso(start);
      const to = this.iso(end);
      const items = paidIn(from, to);
      return {
        from,
        to,
        collected: this.sum(items, (p) => Number(p.amount)),
        principal: this.sum(items, (p) => Number(p.principalAmount)),
        interest: this.sum(items, (p) => Number(p.interestAmount)),
        lateFees: this.sum(items, (p) => Number(p.lateFeeAmount)),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      referenceDate: reference,
      periods: period,
      boxes: {
        kairos: boxBalances[CashBoxType.KAIROS],
        glMotors: boxBalances[CashBoxType.GL_MOTORS],
        management: boxBalances[CashBoxType.MANAGEMENT],
        logistics: boxBalances[CashBoxType.LOGISTICS],
        total: this.round(Object.values(boxBalances).reduce((a, b) => a + b, 0)),
      },
      portfolio: {
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        principalPlaced: this.sum(loans, (l) => Number(l.requestedAmount)),
        principalRecovered: this.sum(payments, (p) => Number(p.principalAmount)),
        principalOutstanding: this.sum(pendingInstallments, (i) => Number(i.remainingAmount ?? i.amount)),
        interestCollected: this.sum(payments, (p) => Number(p.interestAmount)),
        expensesCollected: this.sum(payments, (p) => Number(p.expenseAmount)),
        lateFeesCollected: this.sum(payments, (p) => Number(p.lateFeeAmount)),
        overdueOutstanding: this.sum(overdue, (i) => Number(i.remainingAmount ?? i.amount)),
        overdueInstallments: overdue.length,
      },
      collections: {
        today: this.sum(todayPayments, (p) => Number(p.amount)),
        week: this.sum(weekPayments, (p) => Number(p.amount)),
        month: this.sum(monthPayments, (p) => Number(p.amount)),
        todayCount: todayPayments.length,
        weekCount: weekPayments.length,
        monthCount: monthPayments.length,
      },
      products: {
        kairosStandard: byProduct(LoanProductType.KAIROS_STANDARD),
        glMotors: byProduct(LoanProductType.GL_MOTORS),
      },
      weeklySeries,
      overdue: overdue.slice(0, 20).map((i) => ({
        id: i.id,
        loanId: i.loanId,
        clientName: i.loan?.clientName || '-',
        dueDate: i.dueDate,
        remainingAmount: this.round(Number(i.remainingAmount ?? i.amount)),
        installmentNumber: i.installmentNumber,
        totalInstallments: i.totalInstallments,
        productType: i.loan?.productType,
      })),
    };
  }
}
