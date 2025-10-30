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
}
