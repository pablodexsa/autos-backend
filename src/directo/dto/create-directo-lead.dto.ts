import {
  IsEmail,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DirectoGender } from '../enums/directo-gender.enum';
import { DirectoSaleType } from '../enums/directo-sale-type.enum';

export class CreateDirectoLeadDto {
  @IsNumberString()
  dni: string;

  @IsEnum(DirectoGender)
  gender: DirectoGender;

  @IsOptional()
  @IsEnum(DirectoSaleType)
  saleType?: DirectoSaleType;

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