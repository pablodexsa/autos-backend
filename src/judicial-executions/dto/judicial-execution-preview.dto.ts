export class JudicialExecutionPreviewInstallmentDto {
  id: number;
  saleId: number | null;
  dueDate: string | null;
  amount: number;
  remainingAmount: number;
  judicialNetAmount: number;
}

export class JudicialExecutionPreviewDto {
  clientId: number;
  clientName: string;
  installmentsCount: number;
  executedNetAmount: number;
  installments: JudicialExecutionPreviewInstallmentDto[];
}