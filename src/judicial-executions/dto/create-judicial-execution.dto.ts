import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJudicialExecutionDto {
  @IsInt()
  clientId: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lawFirmName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}