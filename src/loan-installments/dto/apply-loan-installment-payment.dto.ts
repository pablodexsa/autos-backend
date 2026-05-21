import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class ApplyLoanInstallmentPaymentDto {
  @IsNumber()
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  observations?: string;
}