import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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

  // 📋 Listar todos los pagos (ENTIDADES + relations)
  // 📋 Listar todos los pagos (ENTIDADES + relations) + label de cuota (1/12)
  async findAll() {
    const rows = await this.paymentRepo.find({
      relations: [
        'client',
        'installment',
        'installment.client',
        'installment.sale',
        'installment.sale.client',
      ],
      order: { createdAt: 'DESC' },
    });

    // Tomamos los saleIds presentes en los pagos (para calcular N/Total por venta)
    const saleIds = Array.from(
      new Set(
        rows
          .map((p: any) => p.installment?.sale?.id)
          .filter((id: any) => !!id),
      ),
    );

    // Traemos TODAS las cuotas de esas ventas, ordenadas por dueDate
    const allInstallments = saleIds.length
      ? await this.installmentRepo.find({
          where: { sale: { id: In(saleIds) } } as any,
          relations: ['sale'],
          order: { dueDate: 'ASC', id: 'ASC' } as any,
        })
      : [];

    // Map: saleId -> [installmentIds ordenados]
    const saleToInstallmentIds = new Map<number, number[]>();
    for (const inst of allInstallments as any[]) {
      const sid = inst.sale?.id;
      if (!sid) continue;
      if (!saleToInstallmentIds.has(sid)) saleToInstallmentIds.set(sid, []);
      saleToInstallmentIds.get(sid)!.push(inst.id);
    }

    // Devolvemos el mismo objeto de siempre + installmentLabel
    return rows.map((p: any) => {
      const saleId = p.installment?.sale?.id ?? null;
      const instId = p.installment?.id ?? p.installmentId ?? null;

      let installmentLabel: string | null = null;

      if (saleId && instId && saleToInstallmentIds.has(saleId)) {
        const ids = saleToInstallmentIds.get(saleId)!;
        const total = ids.length;
        const idx = ids.indexOf(instId);
        if (idx >= 0) installmentLabel = `${idx + 1}/${total}`;
      }

      return {
        ...p,
        installmentLabel, // ✅ nuevo campo
      };
    });
  }

  // 🔍 Buscar un pago (ENTIDAD + relations)
  async findOne(id: number) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: [
        'client',
        'installment',
        'installment.client',
        'installment.sale',
        'installment.sale.client',
      ],
    });

    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  // 💾 Crear un pago nuevo
  async create(data: {
    installmentId: number;
    amount: number;
    paymentDate: string;
    file?: any;
  }) {
    const installment = await this.installmentRepo.findOne({
      where: { id: data.installmentId },
      relations: ['client', 'sale', 'sale.client'],
    });

    if (!installment) throw new NotFoundException('Cuota no encontrada');

    const client = installment.client ?? installment.sale?.client ?? null;
    if (!client?.id) {
      throw new NotFoundException('Cliente no encontrado para esta cuota');
    }

    const receiptPath = data.file
      ? `/uploads/receipts/${data.file.filename}`
      : null;

    const payment = this.paymentRepo.create({
      installment,
      installmentId: installment.id,
      client,
      clientId: client.id,
      amount: data.amount,
      paymentDate: data.paymentDate,
      receiptPath: receiptPath || undefined,
      isPaid: true,
    });

    // ✅ Actualizar cuota
    installment.paid = true;
    installment.status = 'PAID';
    await this.installmentRepo.save(installment);

    // ✅ Guardar pago
    const saved = await this.paymentRepo.save(payment);

    // 🔁 Releer para que vuelva con relations (client, installment, sale, etc.)
    return this.findOne(saved.id);
  }

  // ❌ Eliminar un pago
  async remove(id: number) {
    const payment = await this.findOne(id); // entidad

    if (payment.receiptPath) {
      const filePath = path.join(__dirname, '../../', payment.receiptPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
