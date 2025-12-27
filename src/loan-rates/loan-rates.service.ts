import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LoanRate, LoanType } from './loan-rate.entity';
import { UpdateLoanRatesMatrixDto } from './dto/update-loan-rates-matrix.dto';

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

  // ============================================================
  // ✅ NUEVO: Settings - Matriz 3x3 (type x months) para editar tasas
  // ============================================================

  private readonly SETTINGS_TYPES = ['prendario', 'personal', 'financiacion'] as const;
  private readonly SETTINGS_MONTHS = [12, 24, 36] as const;

  async getSettingsMatrix() {
    const rows = await this.repo.find({
      where: {
        type: In([...this.SETTINGS_TYPES]) as any,
        months: In([...this.SETTINGS_MONTHS]) as any,
      },
      order: { type: 'ASC', months: 'ASC' },
    });

    // Validar que existan los 9 registros (3*3)
    const missing: Array<{ type: string; months: number }> = [];
    for (const t of this.SETTINGS_TYPES) {
      for (const m of this.SETTINGS_MONTHS) {
        if (!rows.find((r) => r.type === (t as any) && r.months === m)) {
          missing.push({ type: t, months: m });
        }
      }
    }

    if (missing.length) {
      throw new BadRequestException({
        message:
          'Faltan combinaciones en loan_rates para Settings (type, months). Completá esas filas en la tabla.',
        missing,
      });
    }

    const values: Record<string, Record<number, number>> = {
      prendario: { 12: 0, 24: 0, 36: 0 },
      personal: { 12: 0, 24: 0, 36: 0 },
      financiacion: { 12: 0, 24: 0, 36: 0 },
    };

    for (const r of rows) {
      values[String(r.type)][r.months] = Number(r.rate);
    }

    return {
      types: [...this.SETTINGS_TYPES],
      months: [...this.SETTINGS_MONTHS],
      values,
    };
  }

  async updateSettingsMatrix(dto: UpdateLoanRatesMatrixDto) {
    // Actualiza por clave natural (type, months) sin tocar ids
    for (const item of dto.items) {
      const result = await this.repo
        .createQueryBuilder()
        .update(LoanRate)
        .set({ rate: item.rate })
        .where('type = :type AND months = :months', {
          type: item.type,
          months: item.months,
        })
        .execute();

      if (!result.affected) {
        throw new BadRequestException({
          message: 'Registro inexistente para (type, months).',
          type: item.type,
          months: item.months,
        });
      }
    }

    return this.getSettingsMatrix();
  }
}
