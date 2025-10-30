import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstallmentSetting } from './installment-setting.entity';

@Injectable()
export class InstallmentSettingsService {
  constructor(
    @InjectRepository(InstallmentSetting)
    private repo: Repository<InstallmentSetting>,
  ) {}

  findAll() {
    return this.repo.find({ order: { installments: 'ASC' } });
  }
}
