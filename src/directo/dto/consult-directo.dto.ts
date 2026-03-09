import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { DirectoGender } from '../enums/directo-gender.enum';

export class ConsultDirectoDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,8}$/, {
    message: 'El DNI debe contener entre 7 y 8 dígitos numéricos.',
  })
  dni: string;

  @IsEnum(DirectoGender, {
    message: 'El género debe ser M o F.',
  })
  gender: DirectoGender;
}