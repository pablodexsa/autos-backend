import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  // ?? Buscar todos los usuarios (con filtro opcional)
  async findAll(query?: { q?: string }) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .orderBy('user.createdAt', 'DESC');

    if (query?.q) {
      qb.where('LOWER(user.name) LIKE LOWER(:q) OR LOWER(user.email) LIKE LOWER(:q)', {
        q: `%${query.q}%`,
      });
    }

    return qb.getMany();
  }

  // ?? Buscar por ID
  async findOne(id: number) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ?? Buscar por email (usado por auth.service.ts)
  async findByEmail(email: string) {
    return this.userRepo.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  // ?? Crear usuario
  async create(dto: CreateUserDto) {
    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: dto.password, // ?? En producción usar bcrypt
      role,
      isActive: dto.isActive ?? true,
    });

    return this.userRepo.save(user);
  }

  // ?? Actualizar usuario
  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (dto.roleId) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
      user.role = role;
    }

    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  // ?? Eliminar usuario
  async remove(id: number) {
    const user = await this.findOne(id);
    return this.userRepo.remove(user);
  }
}
