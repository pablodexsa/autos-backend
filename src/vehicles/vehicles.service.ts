import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { QueryVehicleDto } from './dto/query-vehicle.dto';
import { Subject } from 'rxjs';
import { Version } from '../versions/version.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private repo: Repository<Vehicle>,
    @InjectRepository(Version) private versionRepo: Repository<Version>,
  ) {}

  private updates$ = new Subject<{ type: 'created' | 'updated' | 'deleted'; id?: number }>();
  getUpdatesStream() { return this.updates$.asObservable(); }
  private notify(type: 'created' | 'updated' | 'deleted', id?: number) { this.updates$.next({ type, id }); }

  async create(dto: CreateVehicleDto) {
    const version = await this.versionRepo.findOne({ where: { id: dto.versionId }, relations: ['model', 'model.brand'] });
    if (!version) throw new NotFoundException('Version not found');

    const v = this.repo.create({
      version,
      brand: version.model.brand.name,
      model: version.model.name,
      versionName: version.name,
      year: dto.year,
      plate: dto.plate,
      engineNumber: dto.engineNumber,
      chassisNumber: dto.chassisNumber,
      color: dto.color,
      price: dto.price,
      status: dto.status,
    });
    const saved = await this.repo.save(v);
    this.notify('created', saved.id);
    return saved;
  }

async findAll(q: QueryVehicleDto) {
  const {
    brandId, modelId, versionId, color, status, plate, q: text,
    yearMin, yearMax, priceMin, priceMax,
    page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC',
  } = q;

  const qb = this.repo.createQueryBuilder('v')
    .leftJoinAndSelect('v.version', 'ver')
    .leftJoinAndSelect('ver.model', 'm')
    .leftJoinAndSelect('m.brand', 'b');

  // 🔹 Filtros por relación
  if (brandId) qb.andWhere('b.id = :brandId', { brandId });
  if (modelId) qb.andWhere('m.id = :modelId', { modelId });
  if (versionId) qb.andWhere('ver.id = :versionId', { versionId });

  // 🔹 Filtros básicos
  if (color) qb.andWhere('LOWER(v.color) LIKE :color', { color: `%${color.toLowerCase()}%` });
  if (plate) qb.andWhere('LOWER(v.plate) LIKE :plate', { plate: `%${plate.toLowerCase()}%` });

  if (yearMin) qb.andWhere('v.year >= :yearMin', { yearMin });
  if (yearMax) qb.andWhere('v.year <= :yearMax', { yearMax });
  if (priceMin) qb.andWhere('v.price >= :priceMin', { priceMin });
  if (priceMax) qb.andWhere('v.price <= :priceMax', { priceMax });

  if (text) {
    qb.andWhere(
      '(LOWER(v.brand) LIKE :t OR LOWER(v.model) LIKE :t OR LOWER(v.versionName) LIKE :t OR LOWER(v.color) LIKE :t OR LOWER(v.plate) LIKE :t)',
      { t: `%${text.toLowerCase()}%` },
    );
  }

  // 🔹 Filtro de disponibilidad (compatibilidad total)
  if (status) {
    qb.andWhere('LOWER(v.status) = LOWER(:status)', { status });
  } else {
    qb.andWhere('(v.sold = false OR LOWER(v.status) = :available)', { available: 'available' });
  }

  // 🔹 Orden y paginación
  qb.orderBy(`v.${sortBy}`, sortOrder)
    .skip((page - 1) * limit)
    .take(limit);

  const [items, total] = await qb.getManyAndCount();
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

  async findOne(id: number) {
    const v = await this.repo.findOne({ where: { id }, relations: ['version', 'version.model', 'version.model.brand'] });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const v = await this.findOne(id);

    if (dto.versionId) {
      const version = await this.versionRepo.findOne({ where: { id: dto.versionId }, relations: ['model', 'model.brand'] });
      if (!version) throw new NotFoundException('Version not found');
      v.version = version;
      v.brand = version.model.brand.name;
      v.model = version.model.name;
      v.versionName = version.name;
    }

    if (dto.year !== undefined) v.year = dto.year;
    if (dto.plate !== undefined) v.plate = dto.plate;
    if (dto.engineNumber !== undefined) v.engineNumber = dto.engineNumber;
    if (dto.chassisNumber !== undefined) v.chassisNumber = dto.chassisNumber;
    if (dto.color !== undefined) v.color = dto.color;
    if (dto.price !== undefined) v.price = dto.price as any;
    if (dto.status !== undefined) v.status = dto.status;

    const saved = await this.repo.save(v);
    this.notify('updated', saved.id);
    return saved;
  }

  async remove(id: number) {
    const v = await this.findOne(id);
    await this.repo.remove(v);
    this.notify('deleted', id);
    return { id };
  }
}
