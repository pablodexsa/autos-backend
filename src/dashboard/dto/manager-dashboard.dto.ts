export interface ManagerDashboardSummaryDto {
  monthlySalesCount: number;
  monthlySalesAmount: number;
  monthlyCollectedInstallmentsCount: number;
  monthlyCollectedInstallmentsAmount: number;
  monthlyExpensesCount: number;
  monthlyExpensesAmount: number;
  monthlyNetAmount: number;
  pendingInstallmentsCount: number;
  pendingInstallmentsAmount: number;
  overdueInstallmentsCount: number;
  overdueInstallmentsAmount: number;
  notYetDueInstallmentsCount: number;
  notYetDueInstallmentsAmount: number;
  receivablesBacklogAmount: number;
}

export interface DashboardMonthlySeriesDto {
  month: string;
  count: number;
  amount: number;
}

export interface DashboardInstallmentsByDueMonthDto {
  month: string;
  dueAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paidCount: number;
  unpaidCount: number;
}

export interface DashboardAgingDto {
  bucket: string;
  count: number;
  amount: number;
}

export interface DashboardInstallmentItemDto {
  id: number;
  installmentNumber: number | null;
  dueDate: string | null;
  amount: number;
  remainingAmount: number;
  status: string | null;
  receiver: string | null;
  daysOverdue?: number;
}

export interface DashboardCashflowDto {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ManagerDashboardDto {
  summary: ManagerDashboardSummaryDto;
  monthlySales: DashboardMonthlySeriesDto[];
  monthlyCollections: DashboardMonthlySeriesDto[];
  monthlyExpenses: DashboardMonthlySeriesDto[];
  monthlyCashflow: DashboardCashflowDto[];
  installmentsByDueMonth: DashboardInstallmentsByDueMonthDto[];
  receivablesAging: DashboardAgingDto[];
  topOverdueInstallments: DashboardInstallmentItemDto[];
  upcomingInstallments: DashboardInstallmentItemDto[];
}