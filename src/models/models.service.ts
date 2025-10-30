import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './model.entity';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { Brand } from '../brands/brand.entity';

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(Model) private repo: Repository<Model>,
    @InjectRepository(Brand) private brandRepo: Repository<Brand>,
  ) {}

  async create(dto: CreateModelDto) {
    const brand = await this.brandRepo.findOne({ where: { id: dto.brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    const m = this.repo.create({ name: dto.name, brand });
    return this.repo.save(m);
  }

  findAll(brandId?: number) {
    const qb = this.repo.createQueryBuilder('m')
      .leftJoinAndSelect('m.brand', 'b')
      .orderBy('b.name', 'ASC')
      .addOrderBy('m.name', 'ASC');
    if (brandId) qb.where('b.id = :brandId', { brandId });
    return qb.getMany();
  }

  async findOne(id: number) {
    const m = await this.repo.findOne({ where: { id }, relations: ['brand'] });
    if (!m) throw new NotFoundException('Model not found');
    return m;
    }

  async update(id: number, dto: UpdateModelDto) {
    const m = await this.findOne(id);
    if (dto.brandId) {
      const brand = await this.brandRepo.findOne({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException('Brand not found');
      m.brand = brand;
    }
    if (dto.name) m.name = dto.name;
    return this.repo.save(m);
  }

  async remove(id: number) {
    const m = await this.findOne(id);
    await this.repo.remove(m);
    return { id };
  }
}
