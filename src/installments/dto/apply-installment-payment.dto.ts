import { IsNumber, IsDateString, IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { TreasuryPaymentMethod } from '../../treasury/treasury.enums';
import { InstallmentReceiver } from '../installment.entity';

export class ApplyInstallmentPaymentDto {
  @IsNumber()
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsEnum(InstallmentReceiver)
  receiver: InstallmentReceiver;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsInt() @Min(1) treasuryAccountId: number;
  @IsEnum(TreasuryPaymentMethod) treasuryPaymentMethod: TreasuryPaymentMethod;
}
