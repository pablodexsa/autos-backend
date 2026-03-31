import {
  IsEmail,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CuotaRedGender } from '../enums/cuotared-gender.enum';

export class CreateCuotaRedLeadDto {
  @IsNumberString()
  dni: string;

  @IsEnum(CuotaRedGender)
  gender: CuotaRedGender;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}