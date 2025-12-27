import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

class LoanRateMatrixItemDto {
  @IsIn(['prendario', 'personal', 'financiacion'])
  type: 'prendario' | 'personal' | 'financiacion';

  @IsInt()
  @IsIn([12, 24, 36])
  months: 12 | 24 | 36;

  @IsNumber()
  @Min(0)
  rate: number;
}

export class UpdateLoanRatesMatrixDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanRateMatrixItemDto)
  items: LoanRateMatrixItemDto[];
}
