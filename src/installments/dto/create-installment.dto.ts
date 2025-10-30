import { IsNumber, IsPositive, IsDateString, IsBoolean, IsOptional } from 'class-validator';

export class CreateInstallmentDto {
  @IsNumber({}, { message: 'El ID de la venta debe ser un número' })
  saleId: number;

  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clientId: number;

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto debe ser positivo' })
  amount: number;

  @IsDateString({}, { message: 'La fecha de vencimiento debe tener formato válido' })
  dueDate: string;

  @IsOptional()
  @IsBoolean({ message: 'El estado de pago debe ser verdadero o falso' })
  paid?: boolean;
}
