import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Installments')
@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get()
  findAll() {
    return this.installmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.findOne(id);
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.markAsPaid(id);
  }

  @Patch(':id/unpay')
  markAsUnpaid(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.markAsUnpaid(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.remove(id);
  }
}
