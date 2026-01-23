import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para filtros y paginación del listado de vehículos.
 */
export class QueryVehicleDto {
  // 🔹 Paginación
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  // 🔹 Búsqueda general
  @IsOptional()
  @IsString()
  q?: string;

  // 🔹 Filtros por texto (si los usás)
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  plate?: string;

  // ✅ NUEVO: filtro por Concesionaria
  @IsOptional()
  @IsString()
  @IsIn(['DG', 'SyS'])
  concesionaria?: 'DG' | 'SyS';

  // 🔹 Filtros por ID (compatibilidad con selects)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brandId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  modelId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  versionId?: number;

  // 🔹 Rango de año
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearMax?: number;

  // 🔹 Rango de precio
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceMax?: number;

  // 🔹 Ordenamiento
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'brand', 'model', 'year', 'price', 'status'])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'brand'
    | 'model'
    | 'year'
    | 'price'
    | 'status';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
