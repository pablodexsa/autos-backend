import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstallmentPayment } from './installment-payment.entity';
import { Installment } from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';
import * as fs from 'fs';
import * as path from 'path';
import type { File as MulterFile } from 'multer';


@Injectable()
export class InstallmentPaymentService {
  constructor(
    @InjectRepository(InstallmentPayment)
    private readonly paymentRepo: Repository<InstallmentPayment>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  // 📋 Listar todos los pagos
  async findAll() {
    return this.paymentRepo.find({
      relations: ['installment', 'installment.sale', 'client'],
      order: { createdAt: 'DESC' },
    });
  }

  // 🔍 Buscar un pago
  async findOne(id: number) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['installment', 'installment.sale', 'client'],
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  // 💾 Crear un pago nuevo
  async create(data: {
    installmentId: number;
    amount: number;
    paymentDate: string;
    file?: MulterFile;
  }) {
    const installment = await this.installmentRepo.findOne({
      where: { id: data.installmentId },
      relations: ['sale', 'sale.client'],
    });

    if (!installment) throw new NotFoundException('Cuota no encontrada');

    const client = installment.sale?.client
      ? await this.clientRepo.findOne({ where: { id: installment.sale.client.id } })
      : null;

    // 🧾 Guardar archivo si se sube comprobante
    const receiptPath = data.file
      ? `/uploads/receipts/${data.file.filename}`
      : null;

    // 💰 Crear el pago
const payment = this.paymentRepo.create({
  installment,
  client: client ?? undefined, // ✅ TypeORM acepta undefined, no null
  amount: data.amount,
  paymentDate: data.paymentDate,
  receiptPath: receiptPath || undefined,
  isPaid: true,
});


    // ✅ Actualizar la cuota
    installment.paid = true;
    installment.status = 'PAID';
    await this.installmentRepo.save(installment);

    // 💾 Guardar el pago
    return await this.paymentRepo.save(payment);
  }

  // ❌ Eliminar un pago
  async remove(id: number) {
    const payment = await this.findOne(id);

    if (payment.receiptPath) {
      const filePath = path.join(__dirname, '../../', payment.receiptPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 🔄 revertir estado de cuota si corresponde
    if (payment.installment) {
      const installment = await this.installmentRepo.findOne({
        where: { id: payment.installment.id },
      });
      if (installment) {
        installment.paid = false;
        installment.status = 'PENDING';
        await this.installmentRepo.save(installment);
      }
    }

    await this.paymentRepo.remove(payment);
    return { message: 'Pago eliminado correctamente' };
  }
}
