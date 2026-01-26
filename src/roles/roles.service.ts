import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.rolesRepo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  async create(name: string, description?: string): Promise<Role> {
    const normalized = String(name ?? '').trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Nombre de rol inválido');

    const exists = await this.rolesRepo.findOne({ where: { name: normalized } });
    if (exists) throw new BadRequestException('El rol ya existe');

    const role = this.rolesRepo.create({
      name: normalized,
      // ✅ tu entity tiene description: string (no nullable) → nunca mandamos null
      description: (description ?? '').trim(),
    });

    return this.rolesRepo.save(role);
  }

  async update(id: number, name: string, description?: string): Promise<Role> {
    const role = await this.findOne(id);

    const normalized = String(name ?? '').trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Nombre de rol inválido');

    if (role.name !== normalized) {
      const exists = await this.rolesRepo.findOne({ where: { name: normalized } });
      if (exists) throw new BadRequestException('Ya existe un rol con ese nombre');
    }

    role.name = normalized;

    // si viene description, lo actualizamos
    if (description !== undefined) {
      role.description = String(description ?? '').trim();
    }

    return this.rolesRepo.save(role);
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const role = await this.findOne(id);
    await this.rolesRepo.remove(role);
    return { deleted: true };
  }
}
