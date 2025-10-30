import { IsString, IsEmail, IsBoolean, IsOptional, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsInt()
  roleId: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
