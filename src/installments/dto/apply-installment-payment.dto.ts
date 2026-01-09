import { IsNumber, IsPositive, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class ApplyInstallmentPaymentDto {
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  amount: number;

  @IsDateString({}, { message: 'La fecha de pago debe tener un formato válido' })
  paymentDate: string;

  @IsIn(['AGENCY', 'STUDIO'], { message: 'Recibe debe ser Agencia o Estudio' })
  receiver: 'AGENCY' | 'STUDIO';

  @IsOptional()
  @IsString()
  observations?: string;
}
