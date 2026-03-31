import { PartialType } from '@nestjs/mapped-types';
import { CreateCuotaRedLeadDto } from './create-cuotared-lead.dto';

export class UpdateCuotaRedLeadDto extends PartialType(CreateCuotaRedLeadDto) {}