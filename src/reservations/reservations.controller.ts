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

  // 🔹 Crear una nueva reserva (PDF con nomenclatura real, sin alertas)
  @Post()
  @ApiOperation({ summary: 'Crear una nueva reserva y generar PDF' })
  async create(@Body() dto: any, @Res() res: Response) {
    try {
      const created = await this.reservationsService.create(dto);
      const buffer = await this.reservationsService.getPdf(created.id);

      const dir = path.join(__dirname, '../../uploads/reservations', String(created.id));
      let fileName = `Reserva-${created.id}.pdf`;

      if (fs.existsSync(dir)) {
        const pdfFiles = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'));
        if (pdfFiles.length > 0) fileName = pdfFiles[0];
      }

      const filePath = path.join(dir, fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buffer);
      }

      console.log(`✅ Reserva creada y PDF guardado como ${fileName}`);

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

  // 🔹 Descargar PDF de reserva con nombre correcto
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar comprobante de reserva en PDF con nombre real' })
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const buffer = await this.reservationsService.getPdf(id);
      const dir = path.join(__dirname, '../../uploads/reservations', String(id));
      let fileName = `Reserva-${id}.pdf`;

      if (fs.existsSync(dir)) {
        const pdfs = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'));
        if (pdfs.length > 0) fileName = pdfs[0];
      }

      console.log(`📤 Enviando archivo real: ${fileName}`);

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

  // 🔹 NUEVO ENDPOINT: Forzar expiración manual de reservas
  @Post('expire')
  @ApiOperation({ summary: 'Marcar manualmente las reservas vencidas y liberar vehículos' })
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
