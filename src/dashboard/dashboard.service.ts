import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  DashboardAgingDto,
  DashboardCashflowDto,
  DashboardInstallmentItemDto,
  DashboardInstallmentsByDueMonthDto,
  DashboardMonthlySeriesDto,
  ManagerDashboardDto,
  ManagerDashboardSummaryDto,
} from './dto/manager-dashboard.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getManagerDashboard(): Promise<ManagerDashboardDto> {
    const salesMeta = await this.resolveSalesTableMeta();
    const refundsMeta = await this.resolveRefundsTableMeta();

    const [
      summary,
      monthlySales,
      monthlyCollections,
      monthlyExpenses,
      monthlyCashflow,
      installmentsByDueMonth,
      receivablesAging,
      topOverdueInstallments,
      upcomingInstallments,
    ] = await Promise.all([
      this.getSummary(salesMeta, refundsMeta),
      this.getMonthlySales(salesMeta),
      this.getMonthlyCollections(),
      this.getMonthlyExpenses(refundsMeta),
      this.getMonthlyCashflow(refundsMeta),
      this.getInstallmentsByDueMonth(),
      this.getReceivablesAging(),
      this.getTopOverdueInstallments(),
      this.getUpcomingInstallments(),
    ]);

    return {
      summary,
      monthlySales,
      monthlyCollections,
      monthlyExpenses,
      monthlyCashflow,
      installmentsByDueMonth,
      receivablesAging,
      topOverdueInstallments,
      upcomingInstallments,
    };
  }

  private async getTableColumns(tableName: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      `,
      [tableName],
    );

    return rows.map((row: { column_name: string }) => row.column_name);
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
      `,
      [tableName],
    );

    return Boolean(rows?.[0]?.exists);
  }

  private async resolveSalesTableMeta(): Promise<{
    exists: boolean;
    amountColumn: string | null;
    dateColumn: string | null;
  }> {
    const exists = await this.tableExists('sales');
    if (!exists) {
      this.logger.warn(
        'La tabla "sales" no existe. El dashboard devolverá ventas en 0.',
      );
      return {
        exists: false,
        amountColumn: null,
        dateColumn: null,
      };
    }

    const columns = await this.getTableColumns('sales');

    const amountCandidates = [
      'price',
      'totalAmount',
      'total',
      'finalPrice',
      'saleAmount',
      'amount',
      'cashPrice',
    ];

    const dateCandidates = [
      'saleDate',
      'createdAt',
      'date',
      'soldAt',
      'operationDate',
      'updatedAt',
    ];

    const amountColumn =
      amountCandidates.find((col) => columns.includes(col)) ?? null;
    const dateColumn =
      dateCandidates.find((col) => columns.includes(col)) ?? null;

    if (!amountColumn || !dateColumn) {
      this.logger.warn(
        `No se pudieron resolver columnas de ventas. amountColumn=${amountColumn} dateColumn=${dateColumn}`,
      );
    }

    return {
      exists: true,
      amountColumn,
      dateColumn,
    };
  }

  private async resolveRefundsTableMeta(): Promise<{
    exists: boolean;
    amountColumn: string | null;
    dateColumn: string | null;
  }> {
    const exists = await this.tableExists('refunds');
    if (!exists) {
      this.logger.warn(
        'La tabla "refunds" no existe. El dashboard devolverá egresos en 0.',
      );
      return {
        exists: false,
        amountColumn: null,
        dateColumn: null,
      };
    }

    const columns = await this.getTableColumns('refunds');

    const amountCandidates = [
      'amount',
      'refundAmount',
      'totalAmount',
      'total',
      'value',
      'price',
    ];

    const dateCandidates = [
      'createdAt',
      'refundDate',
      'date',
      'paymentDate',
      'operationDate',
      'updatedAt',
    ];

    const amountColumn =
      amountCandidates.find((col) => columns.includes(col)) ?? null;
    const dateColumn =
      dateCandidates.find((col) => columns.includes(col)) ?? null;

    if (!amountColumn || !dateColumn) {
      this.logger.warn(
        `No se pudieron resolver columnas de devoluciones. amountColumn=${amountColumn} dateColumn=${dateColumn}`,
      );
    }

    return {
      exists: true,
      amountColumn,
      dateColumn,
    };
  }

  private async getSummary(
    salesMeta: {
      exists: boolean;
      amountColumn: string | null;
      dateColumn: string | null;
    },
    refundsMeta: {
      exists: boolean;
      amountColumn: string | null;
      dateColumn: string | null;
    },
  ): Promise<ManagerDashboardSummaryDto> {
    const monthInstallmentsRows = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE "paymentDate" >= DATE_TRUNC('month', CURRENT_DATE)
            AND "paymentDate" < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
        )::int AS "monthlyCollectedInstallmentsCount",
        COALESCE(SUM(
          CASE
            WHEN "paymentDate" >= DATE_TRUNC('month', CURRENT_DATE)
             AND "paymentDate" < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
            THEN ("amount" - COALESCE("remainingAmount", 0))
            ELSE 0
          END
        ), 0)::numeric AS "monthlyCollectedInstallmentsAmount",

        COUNT(*) FILTER (
          WHERE COALESCE("remainingAmount", 0) > 0
        )::int AS "pendingInstallmentsCount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE("remainingAmount", 0) > 0
            THEN COALESCE("remainingAmount", 0)
            ELSE 0
          END
        ), 0)::numeric AS "pendingInstallmentsAmount",

        COUNT(*) FILTER (
          WHERE COALESCE("remainingAmount", 0) > 0
            AND "dueDate" < CURRENT_DATE
        )::int AS "overdueInstallmentsCount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE("remainingAmount", 0) > 0
             AND "dueDate" < CURRENT_DATE
            THEN COALESCE("remainingAmount", 0)
            ELSE 0
          END
        ), 0)::numeric AS "overdueInstallmentsAmount",

        COUNT(*) FILTER (
          WHERE COALESCE("remainingAmount", 0) > 0
            AND "dueDate" >= CURRENT_DATE
        )::int AS "notYetDueInstallmentsCount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE("remainingAmount", 0) > 0
             AND "dueDate" >= CURRENT_DATE
            THEN COALESCE("remainingAmount", 0)
            ELSE 0
          END
        ), 0)::numeric AS "notYetDueInstallmentsAmount",

        COALESCE(SUM(
          CASE
            WHEN COALESCE("remainingAmount", 0) > 0
            THEN COALESCE("remainingAmount", 0)
            ELSE 0
          END
        ), 0)::numeric AS "receivablesBacklogAmount"
      FROM installments
    `);

    let monthlySalesCount = 0;
    let monthlySalesAmount = 0;

    if (salesMeta.exists && salesMeta.amountColumn && salesMeta.dateColumn) {
      const salesRows = await this.dataSource.query(`
        SELECT
          COUNT(*)::int AS "monthlySalesCount",
          COALESCE(SUM("${salesMeta.amountColumn}"), 0)::numeric AS "monthlySalesAmount"
        FROM sales
        WHERE "${salesMeta.dateColumn}" >= DATE_TRUNC('month', CURRENT_DATE)
          AND "${salesMeta.dateColumn}" < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
      `);

      monthlySalesCount = Number(salesRows?.[0]?.monthlySalesCount ?? 0);
      monthlySalesAmount = Number(salesRows?.[0]?.monthlySalesAmount ?? 0);
    }

    let monthlyExpensesCount = 0;
    let monthlyExpensesAmount = 0;

    if (
      refundsMeta.exists &&
      refundsMeta.amountColumn &&
      refundsMeta.dateColumn
    ) {
      const refundsRows = await this.dataSource.query(`
        SELECT
          COUNT(*)::int AS "monthlyExpensesCount",
          COALESCE(SUM("${refundsMeta.amountColumn}"), 0)::numeric AS "monthlyExpensesAmount"
        FROM refunds
        WHERE "${refundsMeta.dateColumn}" >= DATE_TRUNC('month', CURRENT_DATE)
          AND "${refundsMeta.dateColumn}" < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
      `);

      monthlyExpensesCount = Number(refundsRows?.[0]?.monthlyExpensesCount ?? 0);
      monthlyExpensesAmount = Number(
        refundsRows?.[0]?.monthlyExpensesAmount ?? 0,
      );
    }

    const installments = monthInstallmentsRows?.[0] ?? {};
    const monthlyCollectedInstallmentsAmount = Number(
      installments.monthlyCollectedInstallmentsAmount ?? 0,
    );

    return {
      monthlySalesCount,
      monthlySalesAmount,
      monthlyCollectedInstallmentsCount: Number(
        installments.monthlyCollectedInstallmentsCount ?? 0,
      ),
      monthlyCollectedInstallmentsAmount,
      monthlyExpensesCount,
      monthlyExpensesAmount,
      monthlyNetAmount:
        monthlyCollectedInstallmentsAmount - monthlyExpensesAmount,
      pendingInstallmentsCount: Number(
        installments.pendingInstallmentsCount ?? 0,
      ),
      pendingInstallmentsAmount: Number(
        installments.pendingInstallmentsAmount ?? 0,
      ),
      overdueInstallmentsCount: Number(
        installments.overdueInstallmentsCount ?? 0,
      ),
      overdueInstallmentsAmount: Number(
        installments.overdueInstallmentsAmount ?? 0,
      ),
      notYetDueInstallmentsCount: Number(
        installments.notYetDueInstallmentsCount ?? 0,
      ),
      notYetDueInstallmentsAmount: Number(
        installments.notYetDueInstallmentsAmount ?? 0,
      ),
      receivablesBacklogAmount: Number(
        installments.receivablesBacklogAmount ?? 0,
      ),
    };
  }

  private async getMonthlySales(salesMeta: {
    exists: boolean;
    amountColumn: string | null;
    dateColumn: string | null;
  }): Promise<DashboardMonthlySeriesDto[]> {
    if (!salesMeta.exists || !salesMeta.amountColumn || !salesMeta.dateColumn) {
      return this.buildEmptyLast12MonthsSeries();
    }

    const rows = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "${salesMeta.dateColumn}"), 'YYYY-MM') AS month,
        COUNT(*)::int AS count,
        COALESCE(SUM("${salesMeta.amountColumn}"), 0)::numeric AS amount
      FROM sales
      WHERE "${salesMeta.dateColumn}" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY DATE_TRUNC('month', "${salesMeta.dateColumn}")
      ORDER BY DATE_TRUNC('month', "${salesMeta.dateColumn}")
    `);

    return this.mergeSeriesWithLast12Months(
      rows.map((row: any) => ({
        month: row.month,
        count: Number(row.count ?? 0),
        amount: Number(row.amount ?? 0),
      })),
    );
  }

  private async getMonthlyCollections(): Promise<DashboardMonthlySeriesDto[]> {
    const rows = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "paymentDate"), 'YYYY-MM') AS month,
        COUNT(*)::int AS count,
        COALESCE(SUM(("amount" - COALESCE("remainingAmount", 0))), 0)::numeric AS amount
      FROM installments
      WHERE "paymentDate" IS NOT NULL
        AND "paymentDate" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY DATE_TRUNC('month', "paymentDate")
      ORDER BY DATE_TRUNC('month', "paymentDate")
    `);

    return this.mergeSeriesWithLast12Months(
      rows.map((row: any) => ({
        month: row.month,
        count: Number(row.count ?? 0),
        amount: Number(row.amount ?? 0),
      })),
    );
  }

  private async getMonthlyExpenses(refundsMeta: {
    exists: boolean;
    amountColumn: string | null;
    dateColumn: string | null;
  }): Promise<DashboardMonthlySeriesDto[]> {
    if (
      !refundsMeta.exists ||
      !refundsMeta.amountColumn ||
      !refundsMeta.dateColumn
    ) {
      return this.buildEmptyLast12MonthsSeries();
    }

    const rows = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "${refundsMeta.dateColumn}"), 'YYYY-MM') AS month,
        COUNT(*)::int AS count,
        COALESCE(SUM("${refundsMeta.amountColumn}"), 0)::numeric AS amount
      FROM refunds
      WHERE "${refundsMeta.dateColumn}" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY DATE_TRUNC('month', "${refundsMeta.dateColumn}")
      ORDER BY DATE_TRUNC('month', "${refundsMeta.dateColumn}")
    `);

    return this.mergeSeriesWithLast12Months(
      rows.map((row: any) => ({
        month: row.month,
        count: Number(row.count ?? 0),
        amount: Number(row.amount ?? 0),
      })),
    );
  }

  private async getMonthlyCashflow(
    refundsMeta: {
      exists: boolean;
      amountColumn: string | null;
      dateColumn: string | null;
    },
  ): Promise<DashboardCashflowDto[]> {
    const incomeRows = await this.getMonthlyCollections();
    const expenseRows = await this.getMonthlyExpenses(refundsMeta);

    const months = this.getLast12Months();
    const incomeMap = new Map(incomeRows.map((item) => [item.month, item]));
    const expenseMap = new Map(expenseRows.map((item) => [item.month, item]));

    return months.map((month) => {
      const income = incomeMap.get(month)?.amount ?? 0;
      const expenses = expenseMap.get(month)?.amount ?? 0;

      return {
        month,
        income,
        expenses,
        net: income - expenses,
      };
    });
  }

  private async getInstallmentsByDueMonth(): Promise<
    DashboardInstallmentsByDueMonthDto[]
  > {
    const rows = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "dueDate"), 'YYYY-MM') AS month,
        COALESCE(SUM("amount"), 0)::numeric AS "dueAmount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE("remainingAmount", 0) = 0 THEN "amount"
            ELSE 0
          END
        ), 0)::numeric AS "paidAmount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE("remainingAmount", 0) > 0 THEN COALESCE("remainingAmount", 0)
            ELSE 0
          END
        ), 0)::numeric AS "pendingAmount",
        COUNT(*) FILTER (
          WHERE COALESCE("remainingAmount", 0) = 0
        )::int AS "paidCount",
        COUNT(*) FILTER (
          WHERE COALESCE("remainingAmount", 0) > 0
        )::int AS "unpaidCount"
      FROM installments
      WHERE "dueDate" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY DATE_TRUNC('month', "dueDate")
      ORDER BY DATE_TRUNC('month', "dueDate")
    `);

    const mapped = rows.map((row: any) => ({
      month: row.month,
      dueAmount: Number(row.dueAmount ?? 0),
      paidAmount: Number(row.paidAmount ?? 0),
      pendingAmount: Number(row.pendingAmount ?? 0),
      paidCount: Number(row.paidCount ?? 0),
      unpaidCount: Number(row.unpaidCount ?? 0),
    }));

    return this.mergeInstallmentsByDueMonthWithLast12Months(mapped);
  }

  private async getReceivablesAging(): Promise<DashboardAgingDto[]> {
    const rows = await this.dataSource.query(`
      SELECT
        CASE
          WHEN (CURRENT_DATE - "dueDate") <= 30 THEN '0-30'
          WHEN (CURRENT_DATE - "dueDate") <= 60 THEN '31-60'
          WHEN (CURRENT_DATE - "dueDate") <= 90 THEN '61-90'
          ELSE '90+'
        END AS bucket,
        COUNT(*)::int AS count,
        COALESCE(SUM(COALESCE("remainingAmount", 0)), 0)::numeric AS amount
      FROM installments
      WHERE COALESCE("remainingAmount", 0) > 0
        AND "dueDate" < CURRENT_DATE
      GROUP BY 1
    `);

    const baseOrder = ['0-30', '31-60', '61-90', '90+'];

    const map = new Map<string, DashboardAgingDto>(
      rows.map((row: any) => [
        row.bucket,
        {
          bucket: row.bucket,
          count: Number(row.count ?? 0),
          amount: Number(row.amount ?? 0),
        },
      ]),
    );

    return baseOrder.map((bucket) => ({
      bucket,
      count: map.get(bucket)?.count ?? 0,
      amount: map.get(bucket)?.amount ?? 0,
    }));
  }

  private async getTopOverdueInstallments(): Promise<DashboardInstallmentItemDto[]> {
    const rows = await this.dataSource.query(`
      SELECT
        id,
        "installmentNumber",
        "dueDate",
        "amount",
        COALESCE("remainingAmount", 0) AS "remainingAmount",
        status,
        receiver,
        (CURRENT_DATE - "dueDate")::int AS "daysOverdue"
      FROM installments
      WHERE COALESCE("remainingAmount", 0) > 0
        AND "dueDate" < CURRENT_DATE
      ORDER BY COALESCE("remainingAmount", 0) DESC, "dueDate" ASC
      LIMIT 10
    `);

    return rows.map((row: any) => ({
      id: Number(row.id),
      installmentNumber:
        row.installmentNumber !== null ? Number(row.installmentNumber) : null,
      dueDate: row.dueDate ? String(row.dueDate) : null,
      amount: Number(row.amount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? 0),
      status: row.status ?? null,
      receiver: row.receiver ?? null,
      daysOverdue: Number(row.daysOverdue ?? 0),
    }));
  }

  private async getUpcomingInstallments(): Promise<DashboardInstallmentItemDto[]> {
    const rows = await this.dataSource.query(`
      SELECT
        id,
        "installmentNumber",
        "dueDate",
        "amount",
        COALESCE("remainingAmount", 0) AS "remainingAmount",
        status,
        receiver
      FROM installments
      WHERE COALESCE("remainingAmount", 0) > 0
        AND "dueDate" >= CURRENT_DATE
      ORDER BY "dueDate" ASC
      LIMIT 10
    `);

    return rows.map((row: any) => ({
      id: Number(row.id),
      installmentNumber:
        row.installmentNumber !== null ? Number(row.installmentNumber) : null,
      dueDate: row.dueDate ? String(row.dueDate) : null,
      amount: Number(row.amount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? 0),
      status: row.status ?? null,
      receiver: row.receiver ?? null,
    }));
  }

  private buildEmptyLast12MonthsSeries(): DashboardMonthlySeriesDto[] {
    const months = this.getLast12Months();
    return months.map((month) => ({
      month,
      count: 0,
      amount: 0,
    }));
  }

  private mergeSeriesWithLast12Months(
    rows: DashboardMonthlySeriesDto[],
  ): DashboardMonthlySeriesDto[] {
    const months = this.getLast12Months();
    const map = new Map(rows.map((item) => [item.month, item]));

    return months.map((month) => ({
      month,
      count: map.get(month)?.count ?? 0,
      amount: map.get(month)?.amount ?? 0,
    }));
  }

  private mergeInstallmentsByDueMonthWithLast12Months(
    rows: DashboardInstallmentsByDueMonthDto[],
  ): DashboardInstallmentsByDueMonthDto[] {
    const months = this.getLast12Months();
    const map = new Map(rows.map((item) => [item.month, item]));

    return months.map((month) => ({
      month,
      dueAmount: map.get(month)?.dueAmount ?? 0,
      paidAmount: map.get(month)?.paidAmount ?? 0,
      pendingAmount: map.get(month)?.pendingAmount ?? 0,
      paidCount: map.get(month)?.paidCount ?? 0,
      unpaidCount: map.get(month)?.unpaidCount ?? 0,
    }));
  }

  private getLast12Months(): string[] {
    const months: string[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    return months;
  }
}