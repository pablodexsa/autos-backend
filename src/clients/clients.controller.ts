import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  NotFoundException,
  BadRequestException,
  UseGuards,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as express from 'express';

import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard) // 👈 NECESARIO para que Auditoría tenga usuario
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ✅ Crear nuevo cliente (requiere permiso)
  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('CLIENT_CREATE')
  async create(@Body() data: CreateClientDto) {
    console.log('📩 Datos recibidos en el backend:', data);
    try {
      if (!data.firstName || !data.lastName || !data.dni) {
        throw new BadRequestException(
          'Nombre, apellido y DNI son obligatorios.',
        );
      }
      return await this.clientsService.create(data);
    } catch (error) {
      if ((error as any).response?.message) throw error;
      throw new BadRequestException('Error al crear el cliente.');
    }
  }

  // ✅ Listar todos los clientes (sin permiso por ahora)
  @Get()
  async findAll() {
    return this.clientsService.findAll();
  }

  // ✅ Buscar cliente por DNI (autocompletado / búsqueda rápida) (sin permiso por ahora)
  @Get('search/by-dni')
  async searchByDni(@Query('dni') dni: string) {
    if (!dni || dni.trim() === '') {
      throw new BadRequestException('Debe ingresar un DNI para buscar.');
    }
    return this.clientsService.searchByDni(dni);
  }

  // ============================
  // 📄 SUBIR DNI CLIENTE (sin permiso por ahora)
  // ============================
  @Post(':id/dni')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'uploads', 'client-dni'),
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const base = path.basename(file.originalname, ext);
          const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_');
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${safeBase}-${unique}${ext}`);
        },
      }),
    }),
  )
  async uploadDni(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NotFoundException('No se adjuntó ningún archivo');
    }
    const relativePath = path.join('client-dni', file.filename);
    const updated = await this.clientsService.attachDni(id, relativePath);
    return { ok: true, dniPath: updated.dniPath };
  }

  // ============================
  // 📄 DESCARGAR DNI CLIENTE (sin permiso por ahora)
  // ============================
  @Get(':id/dni')
  async downloadDni(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    const { absPath, filename } = await this.clientsService.getDniPath(id);
    return res.download(absPath, filename);
  }

  // ✅ Obtener cliente por ID (sin permiso por ahora)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const client = await this.clientsService.findOne(id);
    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado.`);
    }
    return client;
  }

  // ✅ Actualizar cliente (requiere permiso)
  @Put(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('CLIENT_EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateClientDto,
  ) {
    try {
      return await this.clientsService.update(id, data);
    } catch (error) {
      if ((error as any).response?.message) throw error;
      throw new BadRequestException('Error al actualizar el cliente.');
    }
  }

  // ✅ Eliminar cliente (no lo pediste en la matriz; lo dejamos solo con auth)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.clientsService.remove(id);
    } catch (error) {
      if ((error as any).response?.message) throw error;
      throw new BadRequestException('Error al eliminar el cliente.');
    }
  }
}
