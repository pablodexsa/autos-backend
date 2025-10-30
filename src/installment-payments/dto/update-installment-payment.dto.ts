import { PartialType } from '@nestjs/mapped-types';
import { CreateInstallmentPaymentDto } from './create-installment-payment.dto';

export class UpdateInstallmentPaymentDto extends PartialType(CreateInstallmentPaymentDto) {}
