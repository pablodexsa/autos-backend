import { IsString, IsNumber, IsInt, IsPositive, IsIn, Length, IsInt as IsInt2 } from 'class-validator';

export class CreateVehicleDto {
  @IsInt()
  versionId: number; // FK

  @IsInt()
  year: number;

  @IsString() @Length(1, 20)
  plate: string;

  @IsString() @Length(1, 100)
  engineNumber: string;

  @IsString() @Length(1, 100)
  chassisNumber: string;

  @IsString() @Length(1, 40)
  color: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString() @IsIn(['available', 'reserved', 'sold'])
  status: string;
}
