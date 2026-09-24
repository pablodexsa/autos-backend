import {
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  IsEnum,
  Max,
  Min,
} from 'class-validator';
import { TreasuryPaymentMethod } from '../../treasury/treasury.enums';

export class CreateLoanDto {
  @IsString()
  clientCuitCuil: string;

  @IsNumber()
  @Min(1)
  requestedAmount: number;

  @IsDateString()
  requestDate: string;

  @IsInt()
  @Min(1)
  @Max(12)
  weeklyInstallments: number;

  @IsInt() @Min(1) treasuryAccountId: number;
  @IsEnum(TreasuryPaymentMethod) treasuryPaymentMethod: TreasuryPaymentMethod;
}