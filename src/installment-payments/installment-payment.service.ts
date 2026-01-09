import {
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstallmentPayment } from './installment-payment.entity';
import { Installment } from '../installments/installment.entity';
import PdfPrinter from 'pdfmake';
import * as path from 'path';

@Injectable()
export class InstallmentPaymentService {
  constructor(
    @InjectRepository(InstallmentPayment)
    private readonly installmentPaymentsRepository: Repository<InstallmentPayment>,

    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
  ) {}

  // ===============================
  // 🔹 CREA UN PAGO DE CUOTA (USADO POR EL CONTROLLER)
  // ===============================
  async create(
    dto: Partial<InstallmentPayment>,
  ): Promise<InstallmentPayment> {
    const payment = this.installmentPaymentsRepository.create(dto);
    const saved = await this.installmentPaymentsRepository.save(payment);
    return saved as InstallmentPayment;
  }


  // =========================
  // 📄 GENERAR COMPROBANTE PDF
  // =========================
  async getReceipt(paymentId: number): Promise<StreamableFile> {
    const payment = await this.installmentPaymentsRepository.findOne({
      where: { id: paymentId },
      relations: [
        'installment',
        'installment.sale',
        'installment.sale.vehicle',
        'installment.client',
        'installment.sale.client',
      ],
    });

    if (!payment) throw new NotFoundException('Payment not found');

    const inst = payment.installment;
    if (!inst) throw new NotFoundException('Installment not found');

    const vehicle = inst.sale?.vehicle ?? null;
    const client = inst.client ?? inst.sale?.client ?? null;

    // Calcular etiqueta X/Y
    let cuotaLabel = '';
    if (inst.installmentNumber && inst.totalInstallments) {
      cuotaLabel = `${inst.installmentNumber}/${inst.totalInstallments}`;
    } else if ((inst as any).installmentLabel) {
      cuotaLabel = (inst as any).installmentLabel;
    } else {
      cuotaLabel = 'Cuota';
    }

    // Info de pago
    const pDate = payment.paymentDate
      ? new Date(payment.paymentDate).toLocaleDateString('es-AR')
      : '—';

    const iDate = inst.paymentDate
      ? new Date(inst.paymentDate).toLocaleDateString('es-AR')
      : pDate;

    // Montos
    const original = Number(inst.amount).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
    });

    const pagado = Number(payment.amount).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
    });

    const restante =
      inst.remainingAmount != null && Number(inst.remainingAmount) > 0
        ? Number(inst.remainingAmount).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
          })
        : null;

    const obs = inst.observations ?? null;

    // Fuentes para pdfmake
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'fonts/Roboto-Bold.ttf'),
        italics: path.join(process.cwd(), 'fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(
          process.cwd(),
          'fonts/Roboto-BoldItalic.ttf',
        ),
      },
    };

    const printer = new PdfPrinter(fonts);

    const docDefinition: any = {
      watermark: {
        text: 'DE GRAZIA AUTOMOTORES',
        color: 'gray',
        opacity: 0.1,
        bold: true,
      },
      content: [
        { text: 'COMPROBANTE DE PAGO', style: 'header', margin: [0, 0, 0, 20] },

        client && {
          text: [
            { text: 'CLIENTE\n', bold: true },
            `${client.lastName} ${client.firstName}\n`,
            `DNI: ${client.dni}\n`,
          ],
          margin: [0, 0, 0, 15],
        },

        vehicle && {
          text: [
            { text: 'VEHÍCULO\n', bold: true },
            `${vehicle.brand} ${vehicle.model} ${vehicle.versionName ?? ''}\n`,
            vehicle.year ? `Año: ${vehicle.year}\n` : '',
            vehicle.color ? `Color: ${vehicle.color}\n` : '',
            vehicle.plate ? `Patente: ${vehicle.plate}\n` : '',
          ].filter(Boolean),
          margin: [0, 0, 0, 20],
        },

        {
          text: `Cuota: ${cuotaLabel}`,
          style: 'subheader',
          margin: [0, 10, 0, 5],
        },

        {
          ul: [
            `Vencimiento: ${new Date(inst.dueDate).toLocaleDateString(
              'es-AR',
            )}`,
            `Monto original: $ ${original}`,
            `Monto del pago: $ ${pagado}`,
            restante ? `Saldo pendiente: $ ${restante}` : `Saldo: $ 0,00`,
          ],
          margin: [0, 0, 0, 10],
        },

        {
          text: 'Detalle del Pago',
          style: 'subheader',
          margin: [0, 10, 0, 5],
        },

        {
          ul: [
            `Fecha registrada: ${pDate}`,
            inst.receiver
              ? `Recibe: ${
                  inst.receiver === 'AGENCY' ? 'Agencia' : 'Estudio'
                }`
              : '',
            obs ? `Observaciones: ${obs}` : '',
          ].filter(Boolean),
        },

        {
          text: '\nGracias por su pago.',
          margin: [0, 30, 0, 0],
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: 'center' },
        subheader: { fontSize: 12, bold: true },
      },
      defaultStyle: {
        font: 'Roboto',
      },
      pageMargins: [40, 60, 40, 60],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Uint8Array[] = [];

    return await new Promise<StreamableFile>((resolve, reject) => {
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () =>
        resolve(new StreamableFile(Buffer.concat(chunks))),
      );
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  async findAll() {
    return this.installmentPaymentsRepository.find({
      relations: ['installment'],
    });
  }

  async findOne(id: number) {
    const payment = await this.installmentPaymentsRepository.findOne({
      where: { id },
      relations: ['installment'],
    });
    if (!payment) throw new NotFoundException('InstallmentPayment not found');
    return payment;
  }

  async remove(id: number) {
    const payment = await this.findOne(id);
    await this.installmentPaymentsRepository.remove(payment);
    return { message: `Payment ${id} deleted.` };
  }
}
