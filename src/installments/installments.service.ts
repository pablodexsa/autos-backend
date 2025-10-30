import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installment } from './installment.entity';
import { Client } from '../clients/entities/client.entity';
import { Sale } from '../sales/sale.entity';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentsRepo: Repository<Installment>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
  ) {}

  /**
   * ?? Listar todas las cuotas
   */
  async findAll() {
    return this.installmentsRepo.find({
      relations: ['sale', 'sale.client'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * ?? Buscar una cuota por ID
   */
  async findOne(id: number) {
    const installment = await this.installmentsRepo.findOne({
      where: { id },
      relations: ['sale', 'sale.client'],
    });
    if (!installment) throw new NotFoundException('Cuota no encontrada');
    return installment;
  }

  /**
   * ?? Marcar una cuota como pagada
   */
  async markAsPaid(id: number) {
    const installment = await this.findOne(id);
    if (installment.paid) {
      throw new BadRequestException('La cuota ya está marcada como pagada');
    }
    installment.paid = true;
    return this.installmentsRepo.save(installment);
  }

  /**
   * ?? Marcar una cuota como impaga
   */
  async markAsUnpaid(id: number) {
    const installment = await this.findOne(id);
    if (!installment.paid) {
      throw new BadRequestException('La cuota ya está impaga');
    }
    installment.paid = false;
    return this.installmentsRepo.save(installment);
  }

  /**
   * ??? Eliminar una cuota
   */
  async remove(id: number) {
    const installment = await this.findOne(id);
    await this.installmentsRepo.remove(installment);
    return { message: 'Cuota eliminada correctamente' };
  }
}
