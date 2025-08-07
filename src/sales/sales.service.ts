import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from './sale.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
  ) {}

  async create(data: { vehicleId: number; saleDate: string; price: number; documentPath?: string }) {
    const vehicle = await this.vehiclesRepository.findOneBy({ id: data.vehicleId });
    if (!vehicle) throw new Error('Vehículo no encontrado');

    const sale = this.salesRepository.create({
      vehicle,
      saleDate: data.saleDate,
      price: data.price,
      documentPath: data.documentPath || null,
    });
    return this.salesRepository.save(sale);
  }

  findAll() {
    return this.salesRepository.find({ relations: ['vehicle'] });
  }
}
