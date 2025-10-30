import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// NOTE: Replace this in-memory store with TypeORM/Prisma implementation.
@Injectable()
export class UsersService {
  private users = [] as any[]; // seeded at startup
  private roles = [
    { id: 1, name: 'admin' },
    { id: 2, name: 'vendedor' },
    { id: 3, name: 'gerencia' },
  ];

  async seedDefaultAdmin() {
    const exists = this.users.find((u) => u.email === 'admin@degrazia.local');
    if (exists) return;
    const hashed = await bcrypt.hash('Ninguno123!', 10);
    this.users.push({ id: 1, name: 'Admin', email: 'admin@degrazia.local', password: hashed, role: this.roles[0] });
  }

  async findAll() {
    return this.users.map((u) => ({ ...u, password: undefined }));
  }
  async findById(id: number) {
    const user = this.users.find((u) => u.id === Number(id));
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...rest } = user;
    return rest;
  }
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }
  async create(dto: any) {
    const id = this.users.length + 1;
    const hashed = await bcrypt.hash(dto.password || 'changeme', 10);
    const role = this.roles.find((r) => r.id === Number(dto.roleId)) || this.roles[1];
    const user = { id, name: dto.name, email: dto.email, password: hashed, role };
    this.users.push(user);
    const { password, ...rest } = user;
    return rest;
  }
  async update(id: number, dto: any) {
    const idx = this.users.findIndex((u) => u.id === Number(id));
    if (idx === -1) throw new NotFoundException('Usuario no encontrado');
    if (dto.password) dto.password = await bcrypt.hash(dto.password, 10);
    this.users[idx] = { ...this.users[idx], ...dto };
    const { password, ...rest } = this.users[idx];
    return rest;
  }
  async remove(id: number) {
    const idx = this.users.findIndex((u) => u.id === Number(id));
    if (idx === -1) throw new NotFoundException('Usuario no encontrado');
    this.users.splice(idx, 1);
    return { success: true };
  }
  async getRoles() {
    return this.roles;
  }
}
