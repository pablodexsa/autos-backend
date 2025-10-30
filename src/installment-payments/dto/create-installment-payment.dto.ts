import { IsNumber, IsPositive, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateInstallmentPaymentDto {
  @IsNumber({}, { message: 'El ID de la cuota debe ser un número' })
  installmentId: number;

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto debe ser positivo' })
  amount: number;

  @IsDateString({}, { message: 'La fecha de pago debe tener un formato válido' })
  paymentDate: string;

  @IsOptional()
  @IsString({ message: 'El nombre del archivo debe ser un texto válido' })
  receiptPath?: string;
}
