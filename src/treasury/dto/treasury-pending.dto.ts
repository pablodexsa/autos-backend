import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { TreasuryCompany, TreasuryPaymentMethod } from '../treasury.enums';
import {
  TreasuryPendingPriority,
  TreasuryPendingStatus,
} from '../treasury-pending.entity';

export class CreateTreasuryPendingDto {
  @IsOptional()
  @IsEnum(TreasuryCompany)
  company?: TreasuryCompany;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterparty?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsEnum(TreasuryPendingPriority)
  priority?: TreasuryPendingPriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTreasuryPendingDto {
  @IsOptional() @IsEnum(TreasuryCompany) company?: TreasuryCompany;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(180) description?: string;
  @IsOptional() @IsString() @MaxLength(160) counterparty?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsEnum(TreasuryPendingPriority) priority?: TreasuryPendingPriority;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(TreasuryPendingStatus) status?: TreasuryPendingStatus;
}

export class PayTreasuryPendingDto {
  @Type(() => Number)
  @IsInt()
  accountId: number;

  @IsEnum(TreasuryPaymentMethod)
  paymentMethod: TreasuryPaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsDateString()
  movementDate?: string;
}
