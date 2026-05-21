import {
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PreviewLoanDto {
  @IsString()
  clientCuitCuil: string;

  @IsNumber()
  @Min(1)
  requestedAmount: number;

  @IsDateString()
  requestDate: string;

  @IsInt()
  @Min(1)
  @Max(6)
  weeklyInstallments: number;
}