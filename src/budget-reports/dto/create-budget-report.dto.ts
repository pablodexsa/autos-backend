export class CreateBudgetReportDto {
  budgetId?: number;
  vehicleId: number;
  clientId: number;
  sellerId?: number | null;
  paymentType: string;          // debe ser string, no opcional
  listPrice?: number;           // 👈 agregado (antes se usaba price)
  finalPrice?: number;
  installments?: number;
  installmentValue?: number;
  downPayment?: number;
  status?: string;
}
