import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';

/**
 * DTO para filtros y paginación del listado de vehículos.
 */
export class QueryVehicleDto {
  // 🔹 Paginación
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  // 🔹 Búsqueda general
  @IsOptional()
  @IsString()
  q?: string;

  // 🔹 Filtros por texto
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

  // 🔹 Filtros por ID (compatibilidad con selects)
  @IsOptional()
  @IsInt()
  brandId?: number;

  @IsOptional()
  @IsInt()
  modelId?: number;

  @IsOptional()
  @IsInt()
  versionId?: number;

  // 🔹 Rango de año
  @IsOptional()
  @IsInt()
  yearMin?: number;

  @IsOptional()
  @IsInt()
  yearMax?: number;

  // 🔹 Rango de precio
  @IsOptional()
  @IsInt()
  priceMin?: number;

  @IsOptional()
  @IsInt()
  priceMax?: number;

  // 🔹 Ordenamiento
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'brand', 'model', 'year', 'price', 'status'])
  sortBy?: 'createdAt' | 'updatedAt' | 'brand' | 'model' | 'year' | 'price' | 'status';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
