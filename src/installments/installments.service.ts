import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Installment } from './installment.entity';
import { Sale } from '../sales/sale.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,

    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,

    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  /**
   * Calcula el monto actual de la cuota aplicando 1% diario
   * sobre el saldo pendiente (remainingAmount) si está vencida.
   */
  private getCurrentAmount(inst: Installment, asOf: Date = new Date()): number {
    const baseRaw =
      inst.remainingAmount != null ? inst.remainingAmount : inst.amount;
    const base = Number(baseRaw);

    if (!inst.dueDate) return +base.toFixed(2);
    if (inst.paid) return +base.toFixed(2);

    const today = new Date(asOf);
    const due = new Date(inst.dueDate);

    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    if (today <= due) {
      // No hay mora
      return +base.toFixed(2);
    }

    const diffMs = today.getTime() - due.getTime();
    const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) return +base.toFixed(2);

    // 1% diario simple sobre el saldo pendiente
    const amountWithInterest = base * (1 + 0.01 * daysLate);
    return +amountWithInterest.toFixed(2);
  }

  // 📋 Listar todas las cuotas
  async findAll() {
    const where: FindOptionsWhere<Installment> = {
      concept: 'PERSONAL_FINANCING',
    };

    const installments = await this.installmentsRepository.find({
      where,
      relations: [
        'sale',
        'sale.client',
        'sale.installments', // ✅ necesario para total y posición
        'payments',
        'client',
      ],
      order: { dueDate: 'ASC' },
    });

    // ✅ Precalcular "número/total" por venta (para no recalcular en cada fila)
    const labelByInstallmentId = new Map<number, string>();

    const bySale = new Map<number, any[]>();
    for (const inst of installments as any[]) {
      const sid = inst.sale?.id;
      if (!sid) continue;
      if (!bySale.has(sid)) bySale.set(sid, []);
      bySale.get(sid)!.push(inst);
    }

    for (const [saleId, list] of bySale.entries()) {
      // Orden real por vencimiento
      const ordered = [...list].sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
      const total = ordered.length;

      ordered.forEach((inst: any, idx: number) => {
        labelByInstallmentId.set(inst.id, `${idx + 1}/${total}`);

        // Si tu entity tiene installmentNumber/totalInstallments y querés
        // mantenerlos sincronizados, podrías setearlos aquí en memoria:
        inst.installmentNumber = idx + 1;
        inst.totalInstallments = total;
      });
    }

    const today = new Date();

    // Normalizamos la respuesta para el frontend
    return installments.map((inst: any) => {
      const currentAmount = this.getCurrentAmount(inst, today);

      // ¿Está vencida?
      let isOverdue = false;
      if (inst.dueDate && !inst.paid) {
        const dToday = new Date(today);
        const due = new Date(inst.dueDate);
        dToday.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        isOverdue = dToday > due;
      }

      const client =
        inst.client ??
        inst.sale?.client ??
        null;

      const payments = inst.payments ?? [];
      const payment = payments.length > 0 ? payments[payments.length - 1] : null;

      return {
        id: inst.id,
        installmentLabel: labelByInstallmentId.get(inst.id) ?? null, // "1/12", "9/12", etc.
        amount: Number(inst.amount),
        remainingAmount:
          inst.remainingAmount != null
            ? Number(inst.remainingAmount)
            : Number(inst.amount),
        currentAmount, // monto con interés de mora aplicado (si corresponde)
        paid: inst.paid === true,
        status: inst.status,
        isOverdue,

        dueDate: inst.dueDate,
        saleId: inst.sale?.id ?? null,

        client: client
          ? {
              firstName: client.firstName,
              lastName: client.lastName,
              dni: client.dni,
            }
          : null,

        payment, // último pago (si existe)

        concept: inst.concept,
        receiver: inst.receiver,
        observations: inst.observations,
      };
    });
  }

  // 🔎 Obtener una cuota por ID
  async findOne(id: number) {
    const inst = await this.installmentsRepository.findOne({
      where: { id },
      relations: ['sale', 'sale.client', 'payments', 'client'],
    });
    if (!inst) throw new NotFoundException('Installment not found');
    return inst;
  }

  /**
   * 💳 Aplicar pago (total o parcial) a una cuota.
   * - Si el monto cancela la cuota, se marca como PAID y remainingAmount = 0.
   * - Si es parcial, se deja remainingAmount con el saldo y status = PARTIALLY_PAID.
   * - Observaciones se acumulan, no se pisan.
   */
  async applyPaymentToInstallment(
    id: number,
    amount: number,
    paymentDate: string,
    receiver: 'AGENCY' | 'STUDIO',
    observations?: string,
  ) {
    const inst = await this.installmentsRepository.findOne({
      where: { id },
      relations: ['sale', 'sale.client', 'payments', 'client'],
    });
    if (!inst) {
      throw new NotFoundException(`Installment ${id} not found`);
    }

    // Inicializamos remainingAmount si aún no se había seteado
    if (inst.remainingAmount == null) {
      inst.remainingAmount = inst.amount;
    }

    const payAmount = Number(amount);
    const prevRemaining = Number(inst.remainingAmount);
    const newRemaining = +(prevRemaining - payAmount).toFixed(2);

    // Observaciones: concatenar al final si viene algo nuevo
    if (observations && observations.trim().length > 0) {
      const prefix = inst.observations ? inst.observations + '\n' : '';
      inst.observations = prefix + observations.trim();
    }

    inst.receiver = receiver;
    inst.lastPaymentAt = new Date(paymentDate);

    if (newRemaining <= 0.01) {
      // Consideramos la cuota saldada
      inst.remainingAmount = 0;
      inst.paid = true;
      inst.status = 'PAID';
      inst.paymentDate = new Date(paymentDate);
    } else {
      // Pago parcial
      inst.remainingAmount = newRemaining;
      inst.paid = false;
      inst.status = 'PARTIALLY_PAID';
      inst.paymentDate = null;
    }

    await this.installmentsRepository.save(inst);

    return {
      id: inst.id,
      paid: inst.paid,
      status: inst.status,
      remainingAmount: inst.remainingAmount,
    };
  }

  // 💳 Marcar cuota como pagada (forzado, sin monto)
  // Lo dejamos por compatibilidad, pero ahora también actualiza remaining/status.
  async markAsPaid(id: number) {
    const inst = await this.findOne(id);

    inst.paid = true;
    inst.status = 'PAID';
    inst.remainingAmount = 0;
    inst.paymentDate = new Date();

    await this.installmentsRepository.save(inst);
    return { message: `Installment ${id} marked as paid.` };
  }

  // 🔁 Revertir pago
  async markAsUnpaid(id: number) {
    const inst = await this.findOne(id);

    inst.paid = false;
    inst.status = 'PENDING';
    inst.remainingAmount = inst.amount;
    inst.paymentDate = null;

    await this.installmentsRepository.save(inst);
    return { message: `Installment ${id} reverted to pending.` };
  }

  // 🗑️ Eliminar cuota
  async remove(id: number) {
    const inst = await this.findOne(id);
    await this.installmentsRepository.remove(inst);
    return { message: `Installment ${id} deleted.` };
  }
}
