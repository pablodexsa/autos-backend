import { PartialType } from '@nestjs/mapped-types';
import { CreateLoanClientDto } from './create-loan-client.dto';

export class UpdateLoanClientDto extends PartialType(CreateLoanClientDto) {}