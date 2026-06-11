import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateKairosLeadDto } from './create-kairos-lead.dto';
import { KairosLeadStatus } from '../kairos-lead.entity';

export class UpdateKairosLeadDto extends PartialType(CreateKairosLeadDto) {
  @IsEnum(KairosLeadStatus)
  @IsOptional()
  status?: KairosLeadStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  bcraStatus?: string;

  @IsOptional()
  bcraRawResult?: any;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  verazStatus?: string;

  @IsOptional()
  verazRawResult?: any;
}