import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsIn,
  Length,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsInt()
  versionId: number; // FK

  @IsInt()
  year: number;

  // ✅ NUEVO: Kilometraje
  @IsOptional()
  @IsInt()
  @Min(0)
  kilometraje?: number | null;

  @IsString()
  @Length(1, 20)
  plate: string;

  @IsString()
  @Length(1, 100)
  engineNumber: string;

  @IsString()
  @Length(1, 100)
  chassisNumber: string;

  // ✅ NUEVO: Concesionaria
  @IsOptional()
  @IsString()
  @IsIn(['DG', 'SyS'])
  concesionaria?: 'DG' | 'SyS' | null;

  // ✅ NUEVO: Procedencia
  @IsOptional()
  @IsString()
  @IsIn(['Randazzo', 'Radatti', 'Consignados', 'Propios'])
  procedencia?: 'Randazzo' | 'Radatti' | 'Consignados' | 'Propios' | null;

  @IsString()
  @Length(1, 40)
  color: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString()
  @IsIn(['available', 'reserved', 'sold'])
  status: string;
}
