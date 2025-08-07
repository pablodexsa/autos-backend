import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './purchase.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchasesRepository: Repository<Purchase>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
  ) {}

  async create(data: { vehicleId: number; purchaseDate: string; price: number; documentPath?: string }) {
    const vehicle = await this.vehiclesRepository.findOneBy({ id: data.vehicleId });
    if (!vehicle) throw new Error('Vehículo no encontrado');

    const purchase = this.purchasesRepository.create({
      vehicle,
      purchaseDate: data.purchaseDate,
      price: data.price,
      documentPath: data.documentPath || null,
    });
    return this.purchasesRepository.save(purchase);
  }

  findAll() {
    return this.purchasesRepository.find({ relations: ['vehicle'] });
  }
}
