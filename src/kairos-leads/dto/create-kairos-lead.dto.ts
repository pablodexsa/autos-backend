import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KairosLeadSource, KairosLeadStatus } from '../kairos-lead.entity';

export class CreateKairosLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cuitCuil: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  businessAddress: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  businessType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  businessAge?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  requestedAmount: number;

  @IsEnum(KairosLeadSource)
  @IsOptional()
  source?: KairosLeadSource;

  @IsEnum(KairosLeadStatus)
  @IsOptional()
  status?: KairosLeadStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  campaign?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  adName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  utmSource?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  utmContent?: string;
}