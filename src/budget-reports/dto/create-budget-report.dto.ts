export class CreateBudgetReportDto {
  vehicleId: number;
  clientId: number;
  sellerId?: number;
  paymentType: string;
  installments?: number;
  listPrice: number;
  finalPrice: number;
  installmentValue?: number;
  downPayment?: number;
}
