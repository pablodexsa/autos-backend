import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async findAll(query?: { q?: string }) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .orderBy('user.createdAt', 'DESC');

    if (query?.q) {
      qb.where(
        'LOWER(user.name) LIKE LOWER(:q) OR LOWER(user.email) LIKE LOWER(:q)',
        { q: `%${query.q}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  // ✅ Crear usuario con contraseña hasheada
  async create(dto: CreateUserDto) {
    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email ya registrado');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashed,
      role,
      isActive: dto.isActive ?? true,
    });

    return this.userRepo.save(user);
  }

  // ✅ Update SEGURO con re-hash y sin pisar datos
  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    // ✅ Cambio de rol
    if (dto.roleId) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
      user.role = role;
    }

    // ✅ Cambio de contraseña
    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 10);
      user.password = hashed;
    }

    // ✅ Update de campos permitidos
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    return this.userRepo.save(user);
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    return this.userRepo.remove(user);
  }
}
