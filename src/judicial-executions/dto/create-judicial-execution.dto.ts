import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJudicialExecutionDto {
  @IsInt()
  @Type(() => Number)
  clientId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  saleIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lawFirmName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}