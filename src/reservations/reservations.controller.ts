import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // 🔹 Listado completo (protegido)
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Listar todas las reservas' })
  async findAll() {
    return this.reservationsService.findAll();
  }

  // 🔹 Obtener una reserva por ID (protegido)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una reserva por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  // 🔹 Crear una nueva reserva (protegido) — sin permiso por ahora (no lo pediste)
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Crear una nueva reserva y generar PDF' })
  async create(@Body() dto: any, @Res() res: Response) {
    try {
      const created = await this.reservationsService.create(dto);
      const buffer = await this.reservationsService.getPdf(created.id);

      const dir = path.join(
        __dirname,
        '../../uploads/reservations',
        String(created.id),
      );
      let fileName = `Reserva-${created.id}.pdf`;

      if (fs.existsSync(dir)) {
        const pdfFiles = fs
          .readdirSync(dir)
          .filter((f) => f.toLowerCase().endsWith('.pdf'));
        if (pdfFiles.length > 0) fileName = pdfFiles[0];
      }

      const filePath = path.join(dir, fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buffer);
      }

      res.status(201).json({
        id: created.id,
        pdfName: fileName,
        pdfPath: `/uploads/reservations/${created.id}/${fileName}`,
      });
    } catch (error) {
      console.error('Error al crear la reserva:', error);
      throw new HttpException(
        'Error al crear la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ ACEPTAR reserva (Gerencia/Admin)
  // Interpretación: aceptar = poner la reserva en "Vigente"
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch(':id/approve')
  @RequirePermissions('RESERVATION_APPROVE')
  @ApiOperation({ summary: 'Aceptar reserva (pasar a Vigente)' })
  async approve(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.reservationsService.update(id, { status: 'Vigente' });
    } catch (error) {
      console.error('Error al aceptar reserva:', error);
      throw new HttpException(
        'Error al aceptar la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ CANCELAR reserva (Gerencia/Admin)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch(':id/cancel')
  @RequirePermissions('RESERVATION_CANCEL')
  @ApiOperation({ summary: 'Cancelar reserva (pasar a Cancelada)' })
  async cancel(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.reservationsService.update(id, { status: 'Cancelada' });
    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      throw new HttpException(
        'Error al cancelar la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔹 Editar reserva existente (Gerencia/Admin)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch(':id')
  @RequirePermissions('RESERVATION_EDIT')
  @ApiOperation({ summary: 'Actualizar una reserva existente' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    try {
      return await this.reservationsService.update(id, dto);
    } catch (error) {
      console.error('Error al actualizar reserva:', error);
      throw new HttpException(
        'Error al actualizar la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔹 Agregar garante con archivos adjuntos (protegido) — sin permiso por ahora
  @UseGuards(JwtAuthGuard)
  @Post(':id/guarantors')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiOperation({
    summary: 'Agregar garante a una reserva con archivos adjuntos',
  })
  async addGuarantor(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
    @UploadedFiles() files: any,
  ) {
    try {
      const mappedFiles = {
        dniFile: files?.filter((f: any) => f.fieldname === 'dniFile'),
        payslipFile: files?.filter((f: any) => f.fieldname === 'payslipFile'),
      };

      return await this.reservationsService.addGuarantor(id, data, mappedFiles);
    } catch (error) {
      console.error('Error al agregar garante:', error);
      throw new HttpException(
        'Error al agregar garante',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔹 Descargar PDF de reserva (SIN GUARD)
  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Descargar comprobante de reserva en PDF con nombre real',
  })
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const buffer = await this.reservationsService.getPdf(id);
      const dir = path.join(
        __dirname,
        '../../uploads/reservations',
        String(id),
      );
      let fileName = `Reserva-${id}.pdf`;

      if (fs.existsSync(dir)) {
        const pdfs = fs
          .readdirSync(dir)
          .filter((f) => f.toLowerCase().endsWith('.pdf'));
        if (pdfs.length > 0) fileName = pdfs[0];
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"`,
      );

      res.send(buffer);
    } catch (error) {
      console.error('Error al generar PDF de la reserva:', error);
      throw new HttpException(
        'Error al generar el PDF de la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔹 Forzar expiración manual (protegido) — sin permiso por ahora
  @UseGuards(JwtAuthGuard)
  @Post('expire')
  @ApiOperation({
    summary: 'Marcar manualmente las reservas vencidas y liberar vehículos',
  })
  async forceExpire() {
    try {
      const result = await this.reservationsService.forceExpire();
      return {
        message: `Proceso de expiración ejecutado correctamente.`,
        result,
      };
    } catch (error) {
      console.error('Error al forzar expiración:', error);
      throw new HttpException(
        'Error al ejecutar la expiración de reservas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
