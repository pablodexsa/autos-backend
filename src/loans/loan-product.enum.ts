export enum LoanProductType {
  KAIROS_STANDARD = 'KAIROS_STANDARD',
  GL_MOTORS = 'GL_MOTORS',
}

export type LoanProductConfig = {
  type: LoanProductType;
  monthlyInterestRate: number;
  dailyLateInterestRate: number;
  fixedExpenses: number;
  expensesThreshold: number | null;
};

export const LOAN_PRODUCT_CONFIG: Record<LoanProductType, LoanProductConfig> = {
  [LoanProductType.KAIROS_STANDARD]: {
    type: LoanProductType.KAIROS_STANDARD,
    monthlyInterestRate: 75,
    dailyLateInterestRate: 5,
    fixedExpenses: 150000,
    expensesThreshold: 1000000,
  },
  [LoanProductType.GL_MOTORS]: {
    type: LoanProductType.GL_MOTORS,
    monthlyInterestRate: 25,
    dailyLateInterestRate: 1,
    fixedExpenses: 0,
    expensesThreshold: null,
  },
};
