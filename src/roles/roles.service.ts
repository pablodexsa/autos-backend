import { Injectable, NotFoundException } from '@nestjs/common';

export interface Role {
  id: number;
  name: string;
}

@Injectable()
export class RolesService {
  private roles: Role[] = [
    { id: 1, name: 'admin' },
    { id: 2, name: 'vendedor' },
    { id: 3, name: 'gerencia' },
  ];

  findAll() {
    return this.roles;
  }

  findOne(id: number) {
    const role = this.roles.find(r => r.id === id);
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  create(name: string) {
    const newRole = { id: this.roles.length + 1, name };
    this.roles.push(newRole);
    return newRole;
  }

  update(id: number, name: string) {
    const role = this.findOne(id);
    role.name = name;
    return role;
  }

  remove(id: number) {
    const index = this.roles.findIndex(r => r.id === id);
    if (index === -1) throw new NotFoundException('Rol no encontrado');
    this.roles.splice(index, 1);
    return { deleted: true };
  }
}
