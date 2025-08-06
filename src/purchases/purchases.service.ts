import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './purchase.entity';

@Injectable()
export class PurchasesService {
  constructor(@InjectRepository(Purchase) private repo: Repository<Purchase>) {}

  create(data: Partial<Purchase>) {
    const purchase = this.repo.create(data);
    return this.repo.save(purchase);
  }

  findAll() {
    return this.repo.find({ relations: ['vehicle'] });
  }
}
