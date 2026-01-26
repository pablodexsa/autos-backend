import { IsInt, IsOptional, Min } from 'class-validator';

export class DeliverRefundDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;
}
