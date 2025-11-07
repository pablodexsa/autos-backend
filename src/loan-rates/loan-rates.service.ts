import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoanRate, LoanType } from './loan-rate.entity';

@Injectable()
export class LoanRatesService {
  constructor(
    @InjectRepository(LoanRate)
    private readonly repo: Repository<LoanRate>,
  ) {}

  findAll() {
    return this.repo.find({ order: { type: 'ASC', months: 'ASC' } });
  }

  // ✅ Aseguramos que 'type' sea del tipo correcto
  findByType(type: LoanType) {
    return this.repo.find({
      where: { type },
      order: { months: 'ASC' },
    });
  }

  // ✅ Igual acá, forzamos el tipo en los argumentos
  async findRate(type: LoanType, months: number) {
    return this.repo.findOne({ where: { type, months } });
  }

  async create(dto: { type: string; months: number; rate: number }) {
    const newRate = this.repo.create({
      type: dto.type as LoanType,
      months: dto.months,
      rate: dto.rate,
    });
    return this.repo.save(newRate);
  }

  async update(id: number, dto: Partial<LoanRate>) {
    const rate = await this.repo.findOne({ where: { id } });
    if (!rate) throw new NotFoundException('Tasa no encontrada');
    Object.assign(rate, dto);
    return this.repo.save(rate);
  }

  async remove(id: number) {
    const rate = await this.repo.findOne({ where: { id } });
    if (!rate) throw new NotFoundException('Tasa no encontrada');
    await this.repo.remove(rate);
    return { message: `Tasa #${id} eliminada correctamente` };
  }
}
