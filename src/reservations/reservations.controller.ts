// src/reservations/reservations.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  Res,
  NotFoundException,
  Sse,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as express from 'express';

import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { AddGuarantorDto } from './dto/add-guarantor.dto';

// ✅ TU ARCHIVO EXPORTA ESTA CLASE (no UpdateStatusDto)
import { UpdateReservationStatusDto as UpdateStatusDto } from './dto/update-status.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

// swagger (si ya lo venías usando)
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Reservations')
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ============================
  // 🔄 STREAM (SSE) DE CAMBIOS (si lo usás)
  // ============================
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.reservationsService.getUpdatesStream().pipe(
      map((event) => ({ data: event } as MessageEvent)),
    );
  }

  // ============================
  // CRUD RESERVAS
  // ============================

  @Get()
  async findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto as any);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, dto as any);
  }

  // (Si querés usar esto, ya compila porque UpdateStatusDto existe como alias)
  // @Patch(':id/status')
  // async updateStatus(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() dto: UpdateStatusDto,
  // ) {
  //   return this.reservationsService.update(id, { status: dto.status } as any);
  // }

  // ============================
  // GARANTES + ADJUNTOS (Cloudinary)
  // ============================

  @Post(':id/guarantors')
  @ApiOperation({
    summary: 'Agregar garante a una reserva (con adjuntos en Cloudinary)',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'dniFile', maxCount: 1 },
        { name: 'payslipFile', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
      },
    ),
  )
  async addGuarantor(
    @Param('id', ParseIntPipe) reservationId: number,
    @Body() dto: AddGuarantorDto,
    @UploadedFiles()
    files: {
      dniFile?: Express.Multer.File[];
      payslipFile?: Express.Multer.File[];
    },
  ) {
    const dniFile = files?.dniFile?.[0];
    const payslipFile = files?.payslipFile?.[0];

    let dniUrl: string | null = null;
    let payslipUrl: string | null = null;

    // ✅ Subimos a Cloudinary (si vienen)
    // Usamos (reservationId + dto.dni) como base => NO necesitás guarantorId aún
    if (dniFile) {
      const up = await this.cloudinaryService.uploadGuarantorDni({
        buffer: dniFile.buffer,
        originalName: dniFile.originalname,
        reservationId,
        dni: dto.dni,
      });
      dniUrl = up.url;
    }

    if (payslipFile) {
      const up = await this.cloudinaryService.uploadGuarantorPayslip({
        buffer: payslipFile.buffer,
        originalName: payslipFile.originalname,
        reservationId,
        dni: dto.dni,
      });
      payslipUrl = up.url;
    }

    return this.reservationsService.addGuarantor(
      reservationId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dni: dto.dni,
        address: (dto as any).address,
        phone: (dto as any).phone,
      },
      {
        dniFilePath: dniUrl,
        payslipFilePath: payslipUrl,
      },
    );
  }

  // ============================
  // 📄 DESCARGAR DOCS DEL GARANTE
  // ✅ Si está en Cloudinary => PROXY (evita about:blank#blocked)
  // ============================

  private async proxyDownloadFromUrl(opts: {
    url: string;
    res: express.Response;
    fallbackFilename: string;
  }) {
    const { url, res, fallbackFilename } = opts;

    // Node 18+ tiene fetch
    const r = await fetch(url);

    if (!r.ok) {
      throw new HttpException(
        `No se pudo descargar el archivo remoto (status ${r.status})`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const contentType = r.headers.get('content-type') || 'application/octet-stream';
    const contentLength = r.headers.get('content-length');

    // intentamos derivar un nombre razonable
    const filename = fallbackFilename;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // stream -> response
    // @ts-ignore - Node fetch body es ReadableStream
    if (!r.body) {
      throw new HttpException(
        'Respuesta remota sin body',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Convertimos WebStream a Node stream
    // @ts-ignore
    const { Readable } = await import('stream');
    // @ts-ignore
    const nodeStream = Readable.fromWeb(r.body);
    return nodeStream.pipe(res);
  }

  @Get('guarantors/:guarantorId/dni')
  async downloadGuarantorDni(
    @Param('guarantorId', ParseIntPipe) guarantorId: number,
    @Res() res: express.Response,
  ) {
    const url = await this.reservationsService.getGuarantorDocUrlIfAny(
      guarantorId,
      'dni',
    );

    // ✅ Cloudinary => proxy download (misma origin, sin popup/redirect)
    if (url) {
      return this.proxyDownloadFromUrl({
        url,
        res,
        fallbackFilename: `garante-${guarantorId}-dni`,
      });
    }

    // legacy: filesystem
    const { absPath, filename } =
      await this.reservationsService.getGuarantorDocPath(guarantorId, 'dni');
    return res.download(absPath, filename);
  }

  @Get('guarantors/:guarantorId/payslip')
  async downloadGuarantorPayslip(
    @Param('guarantorId', ParseIntPipe) guarantorId: number,
    @Res() res: express.Response,
  ) {
    const url = await this.reservationsService.getGuarantorDocUrlIfAny(
      guarantorId,
      'payslip',
    );

    // ✅ Cloudinary => proxy download
    if (url) {
      return this.proxyDownloadFromUrl({
        url,
        res,
        fallbackFilename: `garante-${guarantorId}-recibo`,
      });
    }

    const { absPath, filename } =
      await this.reservationsService.getGuarantorDocPath(
        guarantorId,
        'payslip',
      );
    return res.download(absPath, filename);
  }

  // ============================
  // PDF (ya lo tenías)
  // ============================

  @Get(':id/pdf')
  async getPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    try {
      const pdfBuffer = await this.reservationsService.getPdf(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reserva-${id}.pdf`,
      );
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Error al generar PDF de la reserva:', error);
      throw new HttpException(
        'Error al generar el PDF de la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔹 Forzar expiración manual (si lo tenías)
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