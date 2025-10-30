import { IsInt, IsString } from 'class-validator';

export class AddGuarantorDto {
  @IsInt()
  reservationId: number;

  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() dni: string;
  @IsString() address: string;
  @IsString() phone: string;
}
