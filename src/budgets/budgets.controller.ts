import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  // ?? Listar todos los presupuestos
  @Get()
  findAll() {
    return this.budgetsService.findAll();
  }

  // ?? Obtener un presupuesto por ID
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.findOne(id);
  }

  // ?? Crear nuevo presupuesto
  @Post()
  create(@Body() dto: any) {
    return this.budgetsService.create(dto);
  }

  // ?? Actualizar presupuesto existente
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.budgetsService.update(id, dto);
  }

  // ?? Eliminar presupuesto
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.remove(id);
  }
}
