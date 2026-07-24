import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashBoxMovement, CashBoxType } from './cash-box-movement.entity';

@Injectable()
export class CashBoxMovementsService {
  constructor(
    @InjectRepository(CashBoxMovement)
    private readonly movementsRepo: Repository<CashBoxMovement>,
  ) {}

  async findAll() {
    return this.movementsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getSummary() {
    const raw = await this.movementsRepo
      .createQueryBuilder('movement')
      .select('movement.boxType', 'boxType')
      .addSelect('COALESCE(SUM(movement.amount), 0)', 'balance')
      .groupBy('movement.boxType')
      .getRawMany<{ boxType: CashBoxType; balance: string }>();

    const balances: Record<CashBoxType, number> = {
      [CashBoxType.MANAGEMENT]: 0,
      [CashBoxType.LOGISTICS]: 0,
      [CashBoxType.KAIROS]: 0,
      [CashBoxType.GL_MOTORS]: 0,
    };

    for (const row of raw) balances[row.boxType] = Number(row.balance);

    return { balances };
  }
}
