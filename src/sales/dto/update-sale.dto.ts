import { PartialType } from '@nestjs/swagger';
import { CreateSaleDto } from './create-sale.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSaleDto extends PartialType(CreateSaleDto) {
  @IsOptional()
  @IsString()
  tradeInPlate?: string;
}
