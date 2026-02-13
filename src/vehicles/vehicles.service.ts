import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { QueryVehicleDto } from './dto/query-vehicle.dto';
import { Subject } from 'rxjs';
import { Version } from '../versions/version.entity';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private repo: Repository<Vehicle>,
    @InjectRepository(Version) private versionRepo: Repository<Version>,
  ) {}

  private updates$ = new Subject<{
    type: 'created' | 'updated' | 'deleted';
    id?: number;
  }>();

  getUpdatesStream() {
    return this.updates$.asObservable();
  }

  private notify(type: 'created' | 'updated' | 'deleted', id?: number) {
    this.updates$.next({ type, id });
  }

  async create(dto: CreateVehicleDto) {
    const version = await this.versionRepo.findOne({
      where: { id: dto.versionId },
      relations: ['model', 'model.brand'],
    });
    if (!version) throw new NotFoundException('Version not found');

    const v = this.repo.create({
      version,
      brand: version.model.brand.name,
      model: version.model.name,
      versionName: version.name,
      year: dto.year,

      // ✅ NUEVOS CAMPOS
      kilometraje: dto.kilometraje ?? null,
      concesionaria: dto.concesionaria ?? null,
      procedencia: dto.procedencia ?? null,

      plate: dto.plate,
      engineNumber: dto.engineNumber,
      chassisNumber: dto.chassisNumber,
      color: dto.color,
      price: dto.price,
      status: dto.status,

      // ✅ Soft delete: por defecto activo
      isActive: true,
    });

    const saved = await this.repo.save(v);
    this.notify('created', saved.id);
    return saved;
  }

  async findAll(q: QueryVehicleDto) {
    const {
      brandId,
      modelId,
      versionId,
      color,
      status,
      plate,
      q: text,
      yearMin,
      yearMax,
      priceMin,
      priceMax,

      // ✅ NUEVO FILTRO
      concesionaria,

      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = q;

    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.version', 'ver')
      .leftJoinAndSelect('ver.model', 'm')
      .leftJoinAndSelect('m.brand', 'b');

    // ✅ Soft delete: traer solo activos por defecto
    qb.andWhere('v.isActive = true');

    // 🔹 Filtros por relación
    if (brandId) qb.andWhere('b.id = :brandId', { brandId });
    if (modelId) qb.andWhere('m.id = :modelId', { modelId });
    if (versionId) qb.andWhere('ver.id = :versionId', { versionId });

    // 🔹 Filtros básicos
    if (color) {
      qb.andWhere('LOWER(v.color) LIKE :color', {
        color: `%${color.toLowerCase()}%`,
      });
    }

    if (plate) {
      qb.andWhere('LOWER(v.plate) LIKE :plate', {
        plate: `%${plate.toLowerCase()}%`,
      });
    }

    if (yearMin) qb.andWhere('v.year >= :yearMin', { yearMin });
    if (yearMax) qb.andWhere('v.year <= :yearMax', { yearMax });
    if (priceMin) qb.andWhere('v.price >= :priceMin', { priceMin });
    if (priceMax) qb.andWhere('v.price <= :priceMax', { priceMax });

    // ✅ filtro por Concesionaria
    if (concesionaria) {
      qb.andWhere('v.concesionaria = :concesionaria', { concesionaria });
    }

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
      qb.andWhere('(v.sold = false OR LOWER(v.status) = :available)', {
        available: 'available',
      });
    }

    // 🔹 Orden y paginación (proteger sortBy para evitar SQL injection)
    const allowedSort = new Set([
      'createdAt',
      'updatedAt',
      'year',
      'price',
      'brand',
      'model',
      'versionName',
      'plate',
      'status',
      'color',
      'kilometraje',
      'concesionaria',
      'procedencia',
    ]);
    const safeSortBy = allowedSort.has(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`v.${safeSortBy}`, safeSortOrder as any)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const v = await this.repo.findOne({
      where: { id, isActive: true },
      relations: ['version', 'version.model', 'version.model.brand'],
    });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const v = await this.findOne(id);

    if (dto.versionId) {
      const version = await this.versionRepo.findOne({
        where: { id: dto.versionId },
        relations: ['model', 'model.brand'],
      });
      if (!version) throw new NotFoundException('Version not found');
      v.version = version;
      v.brand = version.model.brand.name;
      v.model = version.model.name;
      v.versionName = version.name;
    }

    if (dto.year !== undefined) v.year = dto.year;

    // ✅ NUEVOS CAMPOS
    if (dto.kilometraje !== undefined) v.kilometraje = dto.kilometraje ?? null;
    if (dto.concesionaria !== undefined)
      v.concesionaria = dto.concesionaria ?? null;
    if (dto.procedencia !== undefined) v.procedencia = dto.procedencia ?? null;

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

  /**
   * 🗑️ "Eliminar" (soft delete): desactiva el vehículo para no romper FKs (budget_reports, sales, etc.)
   */
  async remove(id: number) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehicle not found');

    if (v.isActive === false) {
      return { id, ok: true }; // idempotente
    }

    await this.repo.update(id, { isActive: false });
    this.notify('deleted', id);
    return { id, ok: true };
  }

  /**
   * ♻️ Restaurar vehículo desactivado (opcional, pero útil)
   */
  async restore(id: number) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehicle not found');

    if (v.isActive === true) {
      return { id, ok: true }; // idempotente
    }

    await this.repo.update(id, { isActive: true });
    this.notify('updated', id);
    return { id, ok: true };
  }

  // 📁 Asociar documentación al vehículo (ruta relativa dentro de /uploads)
  async attachDocumentation(id: number, relativePath: string) {
    // permitimos adjuntar documentación a activos (y si querés también a inactivos)
    const vehicle = await this.repo.findOne({ where: { id, isActive: true } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    vehicle.documentationPath = relativePath;
    const saved = await this.repo.save(vehicle);
    this.notify('updated', saved.id);
    return saved;
  }

  // 📁 Obtener ruta absoluta + nombre de archivo de la documentación
  async getDocumentationPath(
    id: number,
  ): Promise<{ absPath: string; filename: string }> {
    const vehicle = await this.repo.findOne({ where: { id, isActive: true } });
    if (!vehicle || !vehicle.documentationPath) {
      throw new NotFoundException(
        'Documentación no encontrada para este vehículo',
      );
    }

    // La documentationPath es relativa a /uploads (por ejemplo: "vehicle-docs/archivo.pdf")
    const absPath = path.join(
      process.cwd(),
      'uploads',
      vehicle.documentationPath,
    );
    const filename = path.basename(absPath);

    if (!fs.existsSync(absPath)) {
      throw new NotFoundException(
        'Archivo de documentación no encontrado en el servidor',
      );
    }

    return { absPath, filename };
  }
}
