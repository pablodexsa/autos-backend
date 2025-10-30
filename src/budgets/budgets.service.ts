import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './budget.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetsRepository: Repository<Budget>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  async findAll() {
    return this.budgetsRepository.find({
      relations: ['vehicle', 'client'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const budget = await this.budgetsRepository.findOne({
      where: { id },
      relations: ['vehicle', 'client'],
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async create(dto: any) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id: dto.vehicleId, sold: false }, // ? ahora funciona porque 'sold' existe
    });
    if (!vehicle) throw new BadRequestException('Vehicle not available');

    const client = await this.clientsRepository.findOne({
      where: { id: dto.clientId },
    });
    if (!client) throw new BadRequestException('Client not found');

    const budget = this.budgetsRepository.create({
      vehicle,
      client,
      price: dto.price,
      status: dto.status ?? 'pending',
    });

    return this.budgetsRepository.save(budget);
  }

  async update(id: number, dto: any) {
    const budget = await this.findOne(id);
    Object.assign(budget, dto);
    return this.budgetsRepository.save(budget);
  }

  async remove(id: number) {
    const budget = await this.findOne(id);
    return this.budgetsRepository.remove(budget);
  }
}
