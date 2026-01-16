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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  // 📋 Listar todos los presupuestos (protegido)
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.budgetsService.findAll();
  }

  // 🔍 Obtener un presupuesto por ID (protegido)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.findOne(id);
  }

  // 🧾 Crear nuevo presupuesto y devolver JSON (protegido)
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: any) {
    const savedBudget = await this.budgetsService.create(dto);
    return savedBudget; // se devuelve el registro guardado, no el PDF
  }

  // ✏️ Actualizar presupuesto existente (protegido)
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.budgetsService.update(id, dto);
  }

  // ❌ Eliminar presupuesto (protegido)
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.remove(id);
  }

  // 📄 Generar y descargar PDF (SIN GUARD para poder abrirlo directo)
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
