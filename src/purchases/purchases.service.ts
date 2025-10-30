import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './purchase.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  async findAll() {
    return this.purchasesRepository.find({
      relations: ['vehicle', 'client'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number) {
    const purchase = await this.purchasesRepository.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });
    if (!purchase) throw new NotFoundException('Compra no encontrada');
    return purchase;
  }

  async create(data: any) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id: data.vehicleId },
    });
    if (!vehicle) throw new BadRequestException('Vehículo no encontrado');

    const client = await this.clientsRepository.findOne({
      where: { id: data.clientId },
    });
    if (!client) throw new BadRequestException('Cliente no encontrado');

    const purchase = this.purchasesRepository.create({
      vehicle,
      client,
      amount: data.amount,
    });

    return this.purchasesRepository.save(purchase);
  }

  async remove(id: number) {
    const purchase = await this.findOne(id);
    return this.purchasesRepository.remove(purchase);
  }
}
