import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle, VehicleCategory } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { QueryVehicleDto } from './dto/query-vehicle.dto';
import { Subject } from 'rxjs';
import { Version } from '../versions/version.entity';
import * as path from 'path';
import * as fs from 'fs';

type VehicleAction = 'READ' | 'CREATE' | 'EDIT' | 'DELETE';

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

  // ============================================================
  // 🔐 Permisos por categoría (Autos/Motos) + compat legacy
  // ============================================================

  private getUserPermissionCodes(user: any): string[] {
    return (
      user?.role?.rolePermissions
        ?.map((rp: any) => rp?.permission?.code)
        .filter(Boolean) || []
    );
  }

  private permissionCode(action: VehicleAction, category: VehicleCategory) {
    return `VEHICLE_${action}_${category}`;
  }

  private genericPermission(action: Exclude<VehicleAction, 'READ'>) {
    return `VEHICLE_${action}`;
  }

  private hasAnyScopedForCategory(
    codes: string[],
    category: VehicleCategory,
  ): boolean {
    return (
      codes.includes(this.permissionCode('READ', category)) ||
      codes.includes(this.permissionCode('CREATE', category)) ||
      codes.includes(this.permissionCode('EDIT', category)) ||
      codes.includes(this.permissionCode('DELETE', category))
    );
  }

  private canReadCategory(codes: string[], category: VehicleCategory): boolean {
    if (codes.includes(this.permissionCode('READ', category))) return true;

    if (this.hasAnyScopedForCategory(codes, category)) return true;

    if (
      codes.includes(this.genericPermission('CREATE')) ||
      codes.includes(this.genericPermission('EDIT')) ||
      codes.includes(this.genericPermission('DELETE'))
    ) {
      return true;
    }

    return false;
  }

  private assertCan(user: any, action: VehicleAction, category: VehicleCategory) {
    const codes = this.getUserPermissionCodes(user);

    if (action === 'READ') {
      if (this.canReadCategory(codes, category)) return;
      throw new ForbiddenException(
        `No tiene permisos para ver ${category === 'CAR' ? 'autos' : 'motos'}`,
      );
    }

    const required = this.permissionCode(action, category);

    if (codes.includes(required)) return;

    const legacy = this.genericPermission(action);
    if (codes.includes(legacy)) return;

    throw new ForbiddenException(
      `No tiene permisos para ${action.toLowerCase()} ${
        category === 'CAR' ? 'autos' : 'motos'
      }`,
    );
  }

  private allowedCategoriesForRead(user: any): VehicleCategory[] {
    const codes = this.getUserPermissionCodes(user);
    const allowed: VehicleCategory[] = [];

    if (this.canReadCategory(codes, 'CAR')) allowed.push('CAR');
    if (this.canReadCategory(codes, 'MOTORCYCLE')) allowed.push('MOTORCYCLE');

    return allowed;
  }

  // ============================================================
  // ✅ CRUD
  // ============================================================

  async create(user: any, dto: CreateVehicleDto) {
    const version = await this.versionRepo.findOne({
      where: { id: dto.versionId },
      relations: ['model', 'model.brand'],
    });
    if (!version) throw new NotFoundException('Version not found');

    const category = (dto.category ?? 'CAR') as VehicleCategory;

    this.assertCan(user, 'CREATE', category);

    const v = this.repo.create({
      version,
      brand: version.model.brand.name,
      model: version.model.name,
      versionName: version.name,
      year: dto.year,
      category,

      kilometraje: dto.kilometraje ?? null,
      concesionaria: dto.concesionaria ?? null,
      procedencia: dto.procedencia ?? null,

      plate: dto.plate,
      engineNumber: dto.engineNumber,
      chassisNumber: dto.chassisNumber,
      color: dto.color,
      price: dto.price,
      status: dto.status,

      isActive: true,
    });

    const saved = await this.repo.save(v);
    this.notify('created', saved.id);
    return saved;
  }

  async findAll(user: any, q: QueryVehicleDto) {
    const allowed = this.allowedCategoriesForRead(user);
    if (allowed.length === 0) {
      throw new ForbiddenException('No tiene permisos para ver vehículos');
    }

    const {
      category,
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
      concesionaria,

      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = q;

    if (category && !allowed.includes(category as VehicleCategory)) {
      throw new ForbiddenException(
        `No tiene permisos para ver ${category === 'CAR' ? 'autos' : 'motos'}`,
      );
    }

    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.version', 'ver')
      .leftJoinAndSelect('ver.model', 'm')
      .leftJoinAndSelect('m.brand', 'b');

    qb.andWhere('v.isActive = true');

    if (category) {
      qb.andWhere('v.category = :category', { category });
    } else {
      qb.andWhere('v.category IN (:...allowed)', { allowed });
    }

    if (brandId) qb.andWhere('b.id = :brandId', { brandId });
    if (modelId) qb.andWhere('m.id = :modelId', { modelId });
    if (versionId) qb.andWhere('ver.id = :versionId', { versionId });

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

    if (concesionaria) {
      qb.andWhere('v.concesionaria = :concesionaria', { concesionaria });
    }

    if (text) {
      qb.andWhere(
        '(LOWER(v.brand) LIKE :t OR LOWER(v.model) LIKE :t OR LOWER(v.versionName) LIKE :t OR LOWER(v.color) LIKE :t OR LOWER(v.plate) LIKE :t)',
        { t: `%${text.toLowerCase()}%` },
      );
    }

    if (status) {
      qb.andWhere('LOWER(v.status) = LOWER(:status)', { status });
    } else {
      qb.andWhere('(v.sold = false OR LOWER(v.status) = :available)', {
        available: 'available',
      });
    }

    const allowedSort = new Set([
      'category',
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
    const safeSortOrder =
      String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`v.${safeSortBy}`, safeSortOrder as any)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(user: any, id: number) {
    const v = await this.repo.findOne({
      where: { id, isActive: true },
      relations: ['version', 'version.model', 'version.model.brand'],
    });
    if (!v) throw new NotFoundException('Vehicle not found');

    this.assertCan(user, 'READ', v.category);
    return v;
  }

  async update(user: any, id: number, dto: UpdateVehicleDto) {
    const v = await this.repo.findOne({
      where: { id, isActive: true },
      relations: ['version', 'version.model', 'version.model.brand'],
    });
    if (!v) throw new NotFoundException('Vehicle not found');

    this.assertCan(user, 'EDIT', v.category);

    const nextCategory = (dto.category ?? v.category) as VehicleCategory;
    if (nextCategory !== v.category) {
      this.assertCan(user, 'EDIT', nextCategory);
      v.category = nextCategory;
    }

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

  async remove(user: any, id: number) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehicle not found');

    this.assertCan(user, 'DELETE', v.category);

    if (v.isActive === false) return { id, ok: true };

    await this.repo.update(id, { isActive: false });
    this.notify('deleted', id);
    return { id, ok: true };
  }

  async restore(user: any, id: number) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehicle not found');

    this.assertCan(user, 'EDIT', v.category);

    if (v.isActive === true) return { id, ok: true };

    await this.repo.update(id, { isActive: true });
    this.notify('updated', id);
    return { id, ok: true };
  }

  // ============================================================
  // 📁 DOCUMENTACIÓN (Cloudinary + legacy filesystem)
  // ============================================================

  /**
   * Guarda en DB la documentación del vehículo.
   * - Nuevo (Cloudinary): documentationPath = "https://..."
   * - Legacy (filesystem): documentationPath = "vehicle-docs/archivo.pdf"
   */
  async attachDocumentation(user: any, id: number, pathOrUrl: string) {
    const vehicle = await this.repo.findOne({ where: { id, isActive: true } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);

    this.assertCan(user, 'EDIT', vehicle.category);

    vehicle.documentationPath = pathOrUrl;
    const saved = await this.repo.save(vehicle);
    this.notify('updated', saved.id);
    return saved;
  }

  /**
   * Si documentationPath es URL, devuelve la URL.
   * Si es null o legacy path, devuelve null.
   */
  async getDocumentationUrlIfAny(user: any, id: number): Promise<string | null> {
    const vehicle = await this.repo.findOne({ where: { id, isActive: true } });
    if (!vehicle || !vehicle.documentationPath) return null;

    this.assertCan(user, 'READ', vehicle.category);

    const p = String(vehicle.documentationPath);
    if (p.startsWith('http://') || p.startsWith('https://')) return p;

    return null;
  }

  /**
   * Legacy: resuelve documentación en filesystem local.
   * En Render Free esto puede fallar porque el disco es efímero.
   */
  async getDocumentationPath(
    user: any,
    id: number,
  ): Promise<{ absPath: string; filename: string }> {
    const vehicle = await this.repo.findOne({ where: { id, isActive: true } });
    if (!vehicle || !vehicle.documentationPath) {
      throw new NotFoundException(
        'Documentación no encontrada para este vehículo',
      );
    }

    this.assertCan(user, 'READ', vehicle.category);

    const p = String(vehicle.documentationPath);

    if (p.startsWith('http://') || p.startsWith('https://')) {
      throw new NotFoundException('Documentación no encontrada en el servidor (URL)');
    }

    const absPath = path.join(process.cwd(), 'uploads', p);
    const filename = path.basename(absPath);

    if (!fs.existsSync(absPath)) {
      throw new NotFoundException(
        'Archivo de documentación no encontrado en el servidor',
      );
    }

    return { absPath, filename };
  }
}