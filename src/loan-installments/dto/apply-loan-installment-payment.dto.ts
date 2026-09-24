import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TreasuryPaymentMethod } from '../../treasury/treasury.enums';

export class ApplyLoanInstallmentPaymentDto {
  @IsNumber()
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsInt() @Min(1) treasuryAccountId: number;
  @IsEnum(TreasuryPaymentMethod) treasuryPaymentMethod: TreasuryPaymentMethod;
}