import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  // 📋 Listar todos los presupuestos
  @Get()
  findAll() {
    return this.budgetsService.findAll();
  }

  // 🔍 Obtener un presupuesto por ID
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.findOne(id);
  }

  // 🧾 Crear nuevo presupuesto y devolver JSON
  @Post()
  async create(@Body() dto: any) {
    const savedBudget = await this.budgetsService.create(dto);
    return savedBudget; // se devuelve el registro guardado, no el PDF
  }

  // ✏️ Actualizar presupuesto existente
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.budgetsService.update(id, dto);
  }

  // ❌ Eliminar presupuesto
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.remove(id);
  }

  // 📄 Generar y descargar PDF
  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdfBuffer = await this.budgetsService.getPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="presupuesto_${id}.pdf"`,
    });
    res.end(pdfBuffer);
  }
}
