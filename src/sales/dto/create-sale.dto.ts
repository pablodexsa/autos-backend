import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateSaleDto {
  // 🧍 Cliente
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  clientDni: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  clientName: string;

  // 🚗 Vehículo
  @IsInt()
  @Min(1)
  vehicleId: number;

  // 💰 Precios y pagos
  @IsNumber()
  basePrice: number;

  @IsBoolean()
  hasTradeIn: boolean;

  @IsNumber()
  @IsOptional()
  tradeInValue?: number;

  // 👇 NUEVO
  @IsOptional()
  @IsString()
  tradeInPlate?: string;

  @IsNumber()
  @IsOptional()
  downPayment?: number;

  // 🏦 Prendario
  @IsNumber()
  @IsOptional()
  prendarioAmount?: number;

  @IsInt()
  @IsOptional()
  prendarioInstallments?: number;

  @IsNumber()
  @IsOptional()
  prendarioMonthlyRate?: number;

  // 💳 Personal
  @IsNumber()
  @IsOptional()
  personalAmount?: number;

  @IsInt()
  @IsOptional()
  personalInstallments?: number;

  @IsNumber()
  @IsOptional()
  personalMonthlyRate?: number;

  // 🏠 Financiación de la casa
  @IsNumber()
  @IsOptional()
  inHouseAmount?: number;

  @IsInt()
  @IsOptional()
  inHouseInstallments?: number;

  @IsNumber()
  @IsOptional()
  inHouseMonthlyRate?: number;

  // 📊 Totales
  @IsNumber()
  finalPrice: number;

  @IsNumber()
  balance: number;

  // 📅 Nuevos campos
  @IsInt()
  paymentDay: number; // 5, 10, 15, 30

  @IsString()
  @IsNotEmpty()
  initialPaymentMonth: string; // "YYYY-MM"
}
