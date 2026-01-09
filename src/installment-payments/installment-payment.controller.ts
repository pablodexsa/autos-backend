import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { InstallmentPaymentService } from './installment-payment.service';

@Controller('installment-payments')
export class InstallmentPaymentController {
  constructor(private readonly paymentService: InstallmentPaymentService) {}

  // 📋 Listar todos los pagos
  @Get()
  findAll() {
    return this.paymentService.findAll();
  }

  // 🧾 Ver detalle de un pago
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.findOne(id);
  }

  // 💾 Registrar un nuevo pago
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/receipts',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}_${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async create(@Body() body: any, @UploadedFile() file?: any) {
    const dto = {
      installmentId: Number(body.installmentId),
      amount: Number(body.amount),
      paymentDate: body.paymentDate,
      file,
    };
    return this.paymentService.create(dto);
  }

  // ❌ Eliminar pago
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.remove(id);
  }

  // 🖨️ Generar y descargar comprobante PDF
  @Get(':id/receipt')
  async generateReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const payment = await this.paymentService.findOne(id);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    // 👉 Helper para formatear fecha sin problemas de zona horaria
    const formatDate = (value: any): string => {
      if (!value) return '-';
      const iso = new Date(value).toISOString().slice(0, 10); // YYYY-MM-DD
      const [y, m, d] = iso.split('-');
      return `${Number(d)}/${Number(m)}/${y}`;
    };

    const pesos = (n?: number) =>
      n != null
        ? `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
        : '-';

    // 📄 Marca de agua (logo con baja opacidad)
    try {
      const logoPath = path.join(__dirname, '../../public/Logobyn.JPG');
      if (fs.existsSync(logoPath)) {
        doc.opacity(0.07).image(logoPath, 100, 150, {
          fit: [400, 400],
          align: 'center',
        });
        doc.opacity(1);
      }
    } catch {
      console.warn('⚠️ No se pudo cargar el logo');
    }

    // 🏷️ Encabezado
    doc
      .fontSize(20)
      .fillColor('#1e1e1e')
      .text('RECIBO DE PAGO', { align: 'center' });
    doc
      .fontSize(12)
      .fillColor('#555')
      .text('De Grazia Automotores', { align: 'center' });
    doc.moveDown(1);
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor('#009879')
      .stroke();
    doc.moveDown(1);

    const section = (title: string) => {
      doc.moveDown(0.8);
      doc
        .fontSize(13)
        .fillColor('#009879')
        .text(title.toUpperCase(), { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#1e1e1e');
    };

    // 🧾 Datos del pago
    section('Datos del Pago');
    doc.text(`ID de pago: ${payment.id}`);
    doc.text(`Fecha de pago: ${formatDate(payment.paymentDate)}`);
    doc.text(`Monto abonado: ${pesos(Number(payment.amount))}`);
    doc.moveDown(1);

    // 👤 Cliente
    section('Cliente');

    const client =
      (payment as any).client ||
      payment.installment?.client ||
      payment.installment?.sale?.client;

    if (client) {
      const fullName =
        [client.firstName, client.lastName].filter(Boolean).join(' ') || '-';
      doc.text(`Nombre: ${fullName}`);
      doc.text(`DNI: ${client.dni ?? '-'}`);
    } else {
      doc.text('Cliente no registrado');
    }

    // 💳 Cuota asociada
    section('Cuota');
    if (payment.installment) {
      const inst = payment.installment;

      // Etiqueta de cuota X/Y
      const cuotaLabel =
        inst.installmentNumber && inst.totalInstallments
          ? `${inst.installmentNumber}/${inst.totalInstallments}`
          : `#${inst.id}`;

      doc.text(`Cuota: ${cuotaLabel}`);
      doc.text(`Vencimiento: ${formatDate(inst.dueDate)}`);
      doc.text(`Monto original: ${pesos(Number(inst.amount))}`);

      // Cálculo de interés y saldos para mostrar valores coherentes con la grilla
      let saldoActual: number | null = null;
      let montoActualAntesPago: number | null = null;

      const baseRemaining =
        inst.remainingAmount != null
          ? Number(inst.remainingAmount)
          : Number(inst.amount);

      // Igual que en el service: usamos HOY para el interés
      const todayForInterest = new Date();
      let daysLate = 0;
      if (inst.dueDate) {
        const due = new Date(inst.dueDate);
        const d0 = new Date(todayForInterest);
        d0.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        if (d0 > due) {
          const diffMs = d0.getTime() - due.getTime();
          daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
      }

      const factor = 1 + 0.01 * daysLate;

      // Saldo actualizado a hoy (después de este pago) → debe coincidir con lo que ves en la página
      const currentAfter =
        factor > 1 ? baseRemaining * factor : baseRemaining;
      saldoActual = +currentAfter.toFixed(2);

      // Monto de la cuota al día de pago (antes de este pago)
      const payAmountNum = Number(payment.amount) || 0;
      const currentBefore = currentAfter + payAmountNum;
      montoActualAntesPago = +currentBefore.toFixed(2);

      if (montoActualAntesPago != null) {
        doc.text(
          `Monto de la cuota al día de pago (antes del pago): ${pesos(
            montoActualAntesPago,
          )}`,
        );
      }

      if (saldoActual != null && saldoActual > 0.009) {
        doc.text(
          `Saldo pendiente actualizado: ${pesos(saldoActual)}`,
        );
      } else {
        doc.text('Saldo pendiente actualizado: $ 0,00');
      }
    }

    // ⚖️ Pie legal
    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#777')
      .text(
        'Este comprobante certifica el pago de la cuota correspondiente según el plan de financiación acordado. El cliente debe conservar este recibo como constancia.',
        { align: 'justify' },
      );

    doc.end();
    const buffer = await done;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="recibo_pago_${id}.pdf"`,
    );
    return res.send(buffer);
  }
}
