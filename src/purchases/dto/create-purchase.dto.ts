import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { TreasuryPaymentMethod } from '../../treasury/treasury.enums';
import { AcquisitionType } from '../purchase.entity';

export class PurchaseTreasuryAllocationDto {
  @IsInt() @Min(1) accountId: number;
  @IsNumber() @IsPositive() amount: number;
  @IsEnum(TreasuryPaymentMethod) paymentMethod: TreasuryPaymentMethod;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export class CreatePurchaseDto {
  @IsInt() @Min(1) vehicleId: number;
  @IsEnum(AcquisitionType) acquisitionType: AcquisitionType;
  @IsOptional() @IsInt() @Min(1) clientId?: number;
  @IsOptional() @IsString() @MaxLength(160) supplierName?: string;
  @IsOptional() @IsInt() @Min(1) relatedSaleId?: number;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseTreasuryAllocationDto)
  treasuryAllocations?: PurchaseTreasuryAllocationDto[];
}
