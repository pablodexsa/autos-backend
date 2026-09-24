import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  IsIn,
  IsDateString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TreasuryPaymentMethod } from '../../treasury/treasury.enums';

export class SaleTreasuryAllocationDto {
  @IsInt()
  @Min(1)
  accountId: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(Object.values(TreasuryPaymentMethod))
  paymentMethod: TreasuryPaymentMethod;
}

export class TradeInVehicleDto {
  @IsInt()
  @Min(1)
  versionId: number;

  @IsInt()
  @Min(1900)
  year: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  kilometraje?: number | null;

  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsString()
  @IsNotEmpty()
  engineNumber: string;

  @IsString()
  @IsNotEmpty()
  chassisNumber: string;

  @IsString()
  @IsNotEmpty()
  color: string;
}

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

  // 🏍️ Plan motos 0km
  @IsOptional()
  @IsIn([
    'contado',
    'anticipo_financiacion',
    'plan_motos_0km',
    'kairos_financing',
  ])
  paymentType?:
    | 'contado'
    | 'anticipo_financiacion'
    | 'plan_motos_0km'
    | 'kairos_financing';

  @IsOptional()
  @IsString()
  motoPlanCode?: string;

  // 💼 Financiación Kairos para ventas GL Motors
  @IsOptional()
  @IsNumber()
  @Min(1)
  kairosFinancedAmount?: number;

  @IsOptional()
  @IsInt()
  @IsIn([6, 8, 10, 12, 15, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36])
  kairosWeeklyInstallments?: number;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  // 💵 Dinero efectivamente cobrado al registrar la venta.
  // Puede distribuirse entre varias cuentas GL.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleTreasuryAllocationDto)
  treasuryAllocations?: SaleTreasuryAllocationDto[];

  // 🚙 Datos completos del usado que ingresa por permuta.
  @IsOptional()
  @ValidateNested()
  @Type(() => TradeInVehicleDto)
  tradeInVehicle?: TradeInVehicleDto;

}