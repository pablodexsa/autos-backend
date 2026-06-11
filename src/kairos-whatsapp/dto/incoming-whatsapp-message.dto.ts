import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class IncomingWhatsappMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  from: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  campaign?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  adName?: string;
}