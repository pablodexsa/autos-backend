import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { LoanInstallmentPayment } from './loan-installment-payment.entity';

@Injectable()
export class LoanInstallmentPaymentsService {
  constructor(
    @InjectRepository(LoanInstallmentPayment)
    private readonly paymentsRepo: Repository<LoanInstallmentPayment>,
  ) {}

  async findAll() {
    return this.paymentsRepo.find({
      relations: ['installment', 'installment.loan', 'installment.client', 'loan', 'client'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number) {
    const payment = await this.paymentsRepo.findOne({
      where: { id },
      relations: ['installment', 'installment.loan', 'installment.client', 'loan', 'client'],
    });

    if (!payment) {
      throw new NotFoundException('Pago de cuota de préstamo no encontrado.');
    }

    return payment;
  }

  private formatDate(value: any): string {
    if (!value) return '-';

    const iso = new Date(value).toISOString().slice(0, 10);
    const [y, m, d] = iso.split('-');

    return `${Number(d)}/${Number(m)}/${y}`;
  }

  private pesos(value?: number | null): string {
    if (value == null) return '-';

    return `$ ${Number(value).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async getReceipt(id: number): Promise<Buffer> {
    const payment = await this.findOne(id);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    try {
      const logoPath = path.join(__dirname, '../../logos/EbenezerLogoByN.png');
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

    doc.fontSize(20).fillColor('#1e1e1e').text('RECIBO DE PAGO', {
      align: 'center',
    });
    doc.fontSize(12).fillColor('#555').text('Ebenezer Capital', {
      align: 'center',
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#009879').stroke();
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

    const client = payment.client ?? payment.installment?.client ?? null;
    const inst = payment.installment;
    const loan = payment.loan ?? inst?.loan ?? null;

    section('Datos del Pago');
    doc.text(`ID de pago: ${payment.id}`);
    doc.text(`Fecha de pago: ${this.formatDate(payment.paymentDate)}`);
    doc.text(`Monto abonado: ${this.pesos(Number(payment.amount))}`);

    section('Cliente');
    if (client) {
      doc.text(`Nombre: ${client.firstName} ${client.lastName}`);
      doc.text(`CUIT/CUIL: ${client.cuitCuil}`);
    } else {
      doc.text('Cliente no registrado');
    }

    section('Cuota');
    if (inst) {
      doc.text(`Cuota: ${inst.installmentNumber}/${inst.totalInstallments}`);
      doc.text(`Vencimiento: ${this.formatDate(inst.dueDate)}`);
      doc.text(`Monto original: ${this.pesos(Number(inst.amount))}`);

      const remaining =
        inst.remainingAmount != null ? Number(inst.remainingAmount) : 0;

      doc.text(`Saldo pendiente: ${this.pesos(remaining)}`);

      if (inst.observations) {
        doc.moveDown(0.5);
        doc.text(`Observaciones: ${inst.observations}`);
      }
    }

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#777')
      .text(
        'Este comprobante certifica el pago de la cuota correspondiente al préstamo personal acordado. El cliente debe conservar este recibo como constancia.',
        { align: 'justify' },
      );

    doc.end();

    return done;
  }
}