import {
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InstallmentPaymentService } from './installment-payment.service';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Installment Payments')
@Controller('installment-payments')
export class InstallmentPaymentController {
  constructor(private readonly paymentService: InstallmentPaymentService) {}

  @Get()
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.findOne(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    const { installmentId, amount, paymentDate } = body;

    if (!installmentId || !amount || !paymentDate) {
      throw new Error('Faltan datos obligatorios en el pago');
    }

    return this.paymentService.create({
      installmentId: Number(installmentId),
      amount: Number(amount),
      paymentDate,
      file,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.remove(id);
  }

  /** ?? Descargar comprobante */
  @Get(':id/receipt')
  async downloadReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const payment = await this.paymentService.findOne(id);

    if (!payment.receiptPath) {
      throw new NotFoundException('El comprobante no está disponible');
    }

    const filePath = path.join(
      __dirname,
      '../../',
      payment.receiptPath.replace('/uploads/', 'uploads/')
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('El archivo no existe en el servidor');
    }

    const ext = path.extname(filePath).toLowerCase();
    let mime = 'application/octet-stream';
    if (ext === '.pdf') mime = 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    if (ext === '.png') mime = 'image/png';

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(filePath)}"`,
    );

    fs.createReadStream(filePath).pipe(res);
  }
}
