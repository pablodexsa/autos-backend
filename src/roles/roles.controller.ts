// roles.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import type { Role } from './roles.service'; // <-- import tipo

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(): Role[] {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Role {
    const role = this.rolesService.findOne(id);
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  @Post()
  create(@Body('name') name: string): Role {
    return this.rolesService.create(name);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body('name') name: string): Role {
    const updatedRole = this.rolesService.update(id, name);
    if (!updatedRole) throw new NotFoundException('Rol no encontrado');
    return updatedRole;
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    const deleted = this.rolesService.remove(id);
    if (!deleted) throw new NotFoundException('Rol no encontrado');
    return { deleted: true };
  }
}
