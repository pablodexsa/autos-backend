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
import { memoryStorage } from 'multer';
import * as express from 'express';

import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  @Get()
  async findAll() {
    return this.clientsService.findAll();
  }

  @Get('search/by-dni')
  async searchByDni(@Query('dni') dni: string) {
    if (!dni || dni.trim() === '') {
      throw new BadRequestException('Debe ingresar un DNI para buscar.');
    }
    return this.clientsService.searchByDni(dni);
  }

  // ============================
  // 📄 SUBIR DNI CLIENTE (Cloudinary)
  // ============================
  @Post(':id/dni')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    }),
  )
  async uploadDni(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NotFoundException('No se adjuntó ningún archivo');
    }

    const uploaded = await this.cloudinaryService.uploadClientDni({
      buffer: file.buffer,
      originalName: file.originalname,
      clientId: id,
    });

    const updated = await this.clientsService.attachDni(id, uploaded.url);
    return { ok: true, dniPath: updated.dniPath };
  }

  // ============================
  // 📄 DESCARGAR DNI CLIENTE
  // ============================
  @Get(':id/dni')
  async downloadDni(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const url = await this.clientsService.getDniUrlIfAny(id);
    if (url) {
      res.redirect(url);
      return;
    }

    // legacy: filesystem
    const { absPath, filename } = await this.clientsService.getDniPath(id);
    res.download(absPath, filename);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const client = await this.clientsService.findOne(id);
    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado.`);
    }
    return client;
  }

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