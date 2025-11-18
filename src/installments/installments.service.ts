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
        'payments',
        'client',
      ],
      order: { dueDate: 'ASC' },
    });

    // Normalizamos la respuesta para el frontend
    return installments.map((inst: any) => ({
      id: inst.id,
      amount: inst.amount,
      paid: inst.paid === true,
      dueDate: inst.dueDate,
      saleId: inst.sale?.id ?? null,

      client: inst.client
        ? {
            firstName: inst.client.firstName,
            lastName: inst.client.lastName,
            dni: inst.client.dni,
          }
        : inst.sale?.client
        ? {
            firstName: inst.sale.client.firstName,
            lastName: inst.sale.client.lastName,
            dni: inst.sale.client.dni,
          }
        : null,

      payment: inst.payments?.length > 0 ? inst.payments[0] : null,

      concept: inst.concept,
    }));
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

  // 💳 Marcar cuota como pagada
  async markAsPaid(id: number) {
    const inst = await this.findOne(id);
    inst.paid = true;
    await this.installmentsRepository.save(inst);
    return { message: `Installment ${id} marked as paid.` };
  }

  // 🔁 Revertir pago
  async markAsUnpaid(id: number) {
    const inst = await this.findOne(id);
    inst.paid = false;
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
