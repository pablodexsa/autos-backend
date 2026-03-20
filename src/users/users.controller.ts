import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  ParseIntPipe,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard) // 👈 necesario para que Auditoría registre el usuario
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 🔐 Validación centralizada de rol
  private checkAdmin(req: any) {
    const user = req?.user;

    const role =
      typeof user?.role === 'string'
        ? user.role.toLowerCase()
        : user?.role?.name?.toLowerCase();

    if (role !== 'admin') {
      throw new ForbiddenException(
        'No tenés permisos para gestionar usuarios',
      );
    }
  }

  // ✅ Obtener todos los usuarios con búsqueda opcional
  @Get()
  findAll(@Query('q') q?: string, @Req() req?: any) {
    this.checkAdmin(req);
    return this.usersService.findAll({ q });
  }

  // ✅ Obtener un usuario por ID
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    this.checkAdmin(req);
    return this.usersService.findOne(id);
  }

  // ✅ Crear usuario
  @Post()
  create(@Body() dto: CreateUserDto, @Req() req?: any) {
    this.checkAdmin(req);
    return this.usersService.create(dto);
  }

  // ✅ Actualizar usuario (parcial)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req?: any,
  ) {
    this.checkAdmin(req);
    return this.usersService.update(id, dto);
  }

  // ✅ Eliminar usuario
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    this.checkAdmin(req);
    return this.usersService.remove(id);
  }
}