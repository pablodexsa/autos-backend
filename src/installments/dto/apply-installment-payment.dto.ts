import { IsNumber, IsDateString, IsOptional, IsString, IsEnum } from 'class-validator';
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
}
