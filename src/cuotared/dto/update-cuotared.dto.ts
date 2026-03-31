import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCuotaRedDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}