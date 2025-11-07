import { IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';

export class CreateBudgetDto {
  @IsNumber()
  vehicleId: number;

  @IsNumber()
  clientId: number;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  status?: string; // "pending" | "approved" | "rejected"

  // 🔹 NUEVOS CAMPOS OPCIONALES
  @IsOptional()
  @IsString()
  paymentType?: string;

  @IsOptional()
  @IsNumber()
  installments?: number;

  @IsOptional()
  @IsNumber()
  downPayment?: number;

  @IsOptional()
  @IsNumber()
  finalPrice?: number;

  @IsOptional()
  @IsNumber()
  installmentValue?: number;

  @IsOptional()
  @IsNumber()
  tradeInValue?: number;

  @IsOptional()
  @IsNumber()
  prendarioRate?: number;

  @IsOptional()
  @IsNumber()
  prendarioMonths?: number;

  @IsOptional()
  @IsNumber()
  prendarioAmount?: number;

  @IsOptional()
  @IsNumber()
  personalRate?: number;

  @IsOptional()
  @IsNumber()
  personalMonths?: number;

  @IsOptional()
  @IsNumber()
  personalAmount?: number;

  @IsOptional()
  @IsNumber()
  financiacionRate?: number;

  @IsOptional()
  @IsNumber()
  financiacionMonths?: number;

  @IsOptional()
  @IsNumber()
  financiacionAmount?: number;
}
