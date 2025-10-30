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
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // 🔹 Listado completo
  @Get()
  @ApiOperation({ summary: 'Listar todas las reservas' })
  async findAll() {
    return this.reservationsService.findAll();
  }

  // 🔹 Obtener una reserva por ID
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una reserva por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  // 🔹 Crear una nueva reserva (genera PDF automáticamente)
  @Post()
  @ApiOperation({ summary: 'Crear una nueva reserva y generar PDF' })
  async create(@Body() dto: any, @Res() res: Response) {
    try {
      const created = await this.reservationsService.create(dto);

      // 🔸 Generar PDF inmediatamente después de crear la reserva
      const buffer = await this.reservationsService.getPdf(created.id);
      const fileName = `reserva_${created.id}.pdf`;

      // Guardar PDF en carpeta local
      const filePath = path.join(
        __dirname,
        '../../uploads/reservations',
        fileName,
      );
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      fs.writeFileSync(filePath, buffer);

      res.status(201).json({
        message: 'Reserva creada correctamente',
        id: created.id,
        pdfPath: `/uploads/reservations/${fileName}`,
      });
    } catch (error) {
      console.error('Error al crear la reserva:', error);
      throw new HttpException(
        'Error al crear la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔹 Actualizar reserva existente
  @Patch(':id')
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

  // 🔹 Agregar garante con archivos adjuntos
  @Post(':id/guarantors')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiOperation({ summary: 'Agregar garante a una reserva con archivos adjuntos' })
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

  // 🔹 Descargar PDF de reserva
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar comprobante de reserva en PDF' })
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const buffer = await this.reservationsService.getPdf(id);
      const fileName = `reserva_${id}.pdf`;

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${fileName}`,
      });
      res.send(buffer);
    } catch (error) {
      console.error('Error al generar PDF de la reserva:', error);
      throw new HttpException(
        'Error al generar el PDF de la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
