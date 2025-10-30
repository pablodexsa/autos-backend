import { IsNumber, IsPositive } from 'class-validator';

export class CreatePurchaseDto {
  @IsNumber({}, { message: 'El ID del vehículo debe ser un número' })
  vehicleId: number;

  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clientId: number;

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto debe ser un número positivo' })
  amount: number;
}
