import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { TreasuryAccountType, TreasuryCompany, TreasuryMovementType, TreasuryPaymentMethod } from '../treasury.enums';

export class CreateTreasuryAccountDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsEnum(TreasuryCompany) company: TreasuryCompany;
  @IsEnum(TreasuryAccountType) type: TreasuryAccountType;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() aliasCbu?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateTreasuryAccountDto extends CreateTreasuryAccountDto { @IsOptional() @IsBoolean() isActive?: boolean; }

export class CreateTreasuryCategoryDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(TreasuryMovementType) movementType: TreasuryMovementType;
  @IsOptional() @IsEnum(TreasuryCompany) company?: TreasuryCompany;
  @IsOptional() @IsInt() parentId?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateTreasuryCategoryDto extends CreateTreasuryCategoryDto { @IsOptional() @IsBoolean() isActive?: boolean; }

export class TreasuryAllocationDto {
  @Type(() => Number) @IsInt() accountId: number;
  @Type(() => Number) @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsEnum(TreasuryPaymentMethod) paymentMethod?: TreasuryPaymentMethod;
  @IsOptional() @IsString() reference?: string;
}
export class CreateTreasuryMovementDto {
  @IsEnum(TreasuryCompany) company: TreasuryCompany;
  @IsEnum(TreasuryMovementType) type: TreasuryMovementType;
  @IsDateString() movementDate: string;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsString() counterparty?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @Type(() => Number) @IsInt() sourceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() loanId?: number;
  @IsOptional() @Type(() => Number) @IsInt() installmentId?: number;
  @IsOptional() @Type(() => Number) @IsInt() paymentId?: number;
  @IsOptional() @Type(() => Number) @IsInt() saleId?: number;
  @IsOptional() @Type(() => Number) @IsInt() clientId?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TreasuryAllocationDto) allocations: TreasuryAllocationDto[];
}
export class CreateTreasuryTransferDto {
  @IsDateString() movementDate: string;
  @Type(() => Number) @IsInt() fromAccountId: number;
  @Type(() => Number) @IsInt() toAccountId: number;
  @Type(() => Number) @IsNumber() @IsPositive() amount: number;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsString() reference?: string;
}
export class OpeningBalanceDto {
  @IsDateString() movementDate: string;
  @Type(() => Number) @IsInt() accountId: number;
  @Type(() => Number) @IsNumber() amount: number;
  @IsOptional() @IsString() description?: string;
}
export class VoidTreasuryMovementDto { @IsString() @IsNotEmpty() reason: string; }
