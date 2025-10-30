import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSaleDto {
  @IsNumber()
  vehicleId: number;

  @IsNumber()
  clientId: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  status?: string; // e.g. "completed" | "pending" | "canceled"
}
