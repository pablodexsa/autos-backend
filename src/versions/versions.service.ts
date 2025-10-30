import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Version } from './version.entity';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { Model } from '../models/model.entity';

@Injectable()
export class VersionsService {
  constructor(
    @InjectRepository(Version) private repo: Repository<Version>,
    @InjectRepository(Model) private modelRepo: Repository<Model>,
  ) {}

  async create(dto: CreateVersionDto) {
    const model = await this.modelRepo.findOne({ where: { id: dto.modelId }, relations: ['brand'] });
    if (!model) throw new NotFoundException('Model not found');
    const v = this.repo.create({ name: dto.name, model });
    return this.repo.save(v);
  }

  findAll(modelId?: number) {
    const qb = this.repo.createQueryBuilder('v')
      .leftJoinAndSelect('v.model', 'm')
      .leftJoinAndSelect('m.brand', 'b')
      .orderBy('b.name', 'ASC')
      .addOrderBy('m.name', 'ASC')
      .addOrderBy('v.name', 'ASC');
    if (modelId) qb.where('m.id = :modelId', { modelId });
    return qb.getMany();
  }

  async findOne(id: number) {
    const v = await this.repo.findOne({ where: { id }, relations: ['model', 'model.brand'] });
    if (!v) throw new NotFoundException('Version not found');
    return v;
  }

  async update(id: number, dto: UpdateVersionDto) {
    const v = await this.findOne(id);
    if (dto.modelId) {
      const model = await this.modelRepo.findOne({ where: { id: dto.modelId } });
      if (!model) throw new NotFoundException('Model not found');
      v.model = model;
    }
    if (dto.name) v.name = dto.name;
    return this.repo.save(v);
  }

  async remove(id: number) {
    const v = await this.findOne(id);
    await this.repo.remove(v);
    return { id };
  }
}
