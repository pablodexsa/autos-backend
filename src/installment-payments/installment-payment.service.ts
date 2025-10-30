import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstallmentPayment } from './installment-payment.entity';
import { Installment } from '../installments/installment.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InstallmentPaymentService {
  constructor(
    @InjectRepository(InstallmentPayment)
    private readonly paymentRepo: Repository<InstallmentPayment>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
  ) {}

  async findAll() {
    return this.paymentRepo.find({ relations: ['installment', 'installment.sale'] });
  }

  async findOne(id: number) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['installment', 'installment.sale'],
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  async create(data: {
    installmentId: number;
    amount: number;
    paymentDate: string;
    file?: Express.Multer.File;
  }) {
    const installment = await this.installmentRepo.findOne({
      where: { id: data.installmentId },
      relations: ['sale', 'sale.client'],
    });

    if (!installment) throw new NotFoundException('Cuota no encontrada');

    const receiptPath = data.file
      ? `/uploads/${data.file.filename}`
      : null;

    const payment = this.paymentRepo.create({
      installment,
      amount: data.amount,
      paymentDate: data.paymentDate,
      receiptPath: receiptPath || undefined,
    });

    installment.paid = true;
    await this.installmentRepo.save(installment);

    return this.paymentRepo.save(payment);
  }

  async remove(id: number) {
    const payment = await this.findOne(id);

    if (payment.receiptPath) {
      const filePath = path.join(__dirname, '../../', payment.receiptPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await this.paymentRepo.remove(payment);
    return { message: 'Pago eliminado correctamente' };
  }
}
