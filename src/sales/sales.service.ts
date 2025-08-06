import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from './sale.entity';

@Injectable()
export class SalesService {
  constructor(@InjectRepository(Sale) private repo: Repository<Sale>) {}

  create(data: Partial<Sale>) {
    const sale = this.repo.create(data);
    return this.repo.save(sale);
  }

  findAll() {
    return this.repo.find({ relations: ['vehicle'] });
  }
}
