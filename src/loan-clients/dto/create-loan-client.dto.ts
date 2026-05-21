import { IsOptional, IsString, Length } from 'class-validator';

export class CreateLoanClientDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @Length(10, 20)
  cuitCuil: string;

  @IsOptional()
  @IsString()
  workAddress?: string;

  @IsOptional()
  @IsString()
  aliasOrCbu?: string;
}