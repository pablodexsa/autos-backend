import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
   * asOf indica la fecha de referencia para el cálculo (normalmente HOY).
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
        'sale.vehicle',      // ✅ necesario para patente / datos de vehículo
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

    for (const [, list] of bySale.entries()) {
      // Orden real por vencimiento
      const ordered = [...list].sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
      const total = ordered.length;

      ordered.forEach((inst: any, idx: number) => {
        labelByInstallmentId.set(inst.id, `${idx + 1}/${total}`);

        // Sincronizamos campos de numeración si existen en la entity
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

      const client = inst.client ?? inst.sale?.client ?? null;
      const vehicle = inst.sale?.vehicle ?? null;

      // ✅ Ordenar pagos por fecha (y como respaldo por id) y tomar el último
      const paymentsArr = Array.isArray(inst.payments)
        ? [...inst.payments]
        : [];
      paymentsArr.sort((a: any, b: any) => {
        const da = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
        const db = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;

        if (da !== db) return da - db;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const payment =
        paymentsArr.length > 0
          ? paymentsArr[paymentsArr.length - 1]
          : null;

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

        // 👇 NUEVO: datos del vehículo para poder mostrar patente en el frontend
        vehicle: vehicle
          ? {
              id: vehicle.id,
              plate: vehicle.plate,
              brand: vehicle.brand,
              model: vehicle.model,
              versionName: vehicle.versionName,
              year: vehicle.year,
              color: vehicle.color,
            }
          : null,

        payment, // 👉 último pago registrado

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
      relations: ['sale', 'sale.client', 'payments', 'sale.vehicle', 'client'],
    });
    if (!inst) throw new NotFoundException('Installment not found');
    return inst;
  }

  /**
   * 💳 Aplicar pago (total o parcial) a una cuota.
   * - Si el monto cancela la cuota, se marca como PAID y remainingAmount = 0.
   * - Si es parcial, se deja remainingAmount con el saldo y status = PARTIALLY_PAID.
   * - Observaciones se acumulan, no se pisan.
   * - Se contempla 1 % diario, usando la MISMA fecha de referencia que la grilla (hoy).
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

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a 0.');
    }

    // Principal base (sin interés) antes del pago
    let basePrincipal =
      inst.remainingAmount != null
        ? Number(inst.remainingAmount)
        : Number(inst.amount);

    if (basePrincipal <= 0) {
      throw new BadRequestException(
        'La cuota no tiene saldo pendiente para pagar.',
      );
    }

    // Fecha de referencia para el interés: HOY (igual que la grilla)
    const todayForInterest = new Date();

    // Cálculo de días de mora respecto a hoy
    const due = inst.dueDate ? new Date(inst.dueDate) : null;
    let daysLate = 0;
    if (due) {
      const d0 = new Date(todayForInterest);
      const dDue = new Date(due);
      d0.setHours(0, 0, 0, 0);
      dDue.setHours(0, 0, 0, 0);

      if (d0 > dDue) {
        const diffMs = d0.getTime() - dDue.getTime();
        daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    // Factor de interés según días de mora (respecto de hoy)
    const factor = 1 + 0.01 * daysLate;

    // Monto actual adeudado a la fecha de referencia (hoy)
    const currentAmount = +(
      factor > 1 ? basePrincipal * factor : basePrincipal
    ).toFixed(2);

    // No permitir pagar más de lo que vale hoy la cuota
    if (payAmount > currentAmount + 0.01) {
      throw new BadRequestException(
        `El monto a pagar ($${payAmount.toFixed(
          2,
        )}) no puede superar el valor actual de la cuota ($${currentAmount.toFixed(
          2,
        )}).`,
      );
    }

    // Observaciones: concatenar al final si viene algo nuevo
    if (observations && observations.trim().length > 0) {
      const prefix = inst.observations ? inst.observations + '\n' : '';
      inst.observations = prefix + observations.trim();
    }

    // Guardamos la fecha "real" de pago para trazabilidad y recibo
    const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
    inst.receiver = receiver;
    inst.lastPaymentAt = effectiveDate;

    if (payAmount >= currentAmount - 0.01) {
      // Consideramos la cuota saldada
      inst.remainingAmount = 0;
      inst.paid = true;
      inst.status = 'PAID';
      inst.paymentDate = effectiveDate;
    } else {
      /**
       * Pago parcial:
       * Queremos que:
       *   current_after(hoy) = current_before(hoy) - pago
       *
       * current_before(hoy) = P * factor
       * current_after(hoy)  = P' * factor
       * => P' * factor = P * factor - pago
       * => P' = P - pago / factor
       */
      const divisor = factor > 0 ? factor : 1;
      const newPrincipal = basePrincipal - payAmount / divisor;

      inst.remainingAmount = +Math.max(newPrincipal, 0).toFixed(2);
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
