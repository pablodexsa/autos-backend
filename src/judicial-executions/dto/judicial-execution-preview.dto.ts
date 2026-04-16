export class JudicialExecutionPreviewInstallmentDto {
  id: number;
  saleId: number | null;
  plate: string | null;
  vehicleLabel: string | null;
  installmentNumber: number | null;
  dueDate: string | null;
  amount: number;
  remainingAmount: number;
  judicialNetAmount: number;
}

export class JudicialExecutionPreviewDto {
  clientId: number;
  clientName: string;
  selectedSaleIds: number[];
  installmentsCount: number;
  executedNetAmount: number;
  installments: JudicialExecutionPreviewInstallmentDto[];
}