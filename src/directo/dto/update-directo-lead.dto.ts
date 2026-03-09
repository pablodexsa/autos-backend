import { PartialType } from '@nestjs/mapped-types';
import { CreateDirectoLeadDto } from './create-directo-lead.dto';

export class UpdateDirectoLeadDto extends PartialType(CreateDirectoLeadDto) {}