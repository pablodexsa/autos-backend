import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { CuotaRedGender } from '../enums/cuotared-gender.enum';

export class ConsultCuotaRedDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,8}$/, {
    message: 'El DNI debe contener entre 7 y 8 dígitos numéricos.',
  })
  dni: string;

  @IsEnum(CuotaRedGender, {
    message: 'El género debe ser M o F.',
  })
  gender: CuotaRedGender;
}