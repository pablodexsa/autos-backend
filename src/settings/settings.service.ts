import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  /**
   * Obtiene un valor crudo (string) según key.
   * Devuelve null si no existe.
   */
  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? row.value : null;
  }

  /**
   * Obtiene un valor numérico garantizado.
   * Si no existe o no es número válido, devuelve fallback.
   */
  async getNumber(key: string, fallback: number): Promise<number> {
    const raw = await this.get(key);
    const n = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Setter genérico: crea o actualiza un valor
   */
  async set(key: string, value: string) {
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ key, value }));
  }
}
