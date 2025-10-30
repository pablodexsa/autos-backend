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
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ✅ Crear nuevo cliente
@Post()
async create(@Body() data: CreateClientDto) {
  console.log('📩 Datos recibidos en el backend:', data); // 👈 Agregalo acá
  try {
    if (!data.firstName || !data.lastName || !data.dni) {
      throw new BadRequestException('Nombre, apellido y DNI son obligatorios.');
    }
    return await this.clientsService.create(data);
  } catch (error) {
    if (error.response?.message) throw error; // errores del servicio (409, 400, etc.)
    throw new BadRequestException('Error al crear el cliente.');
  }
}


  // ✅ Listar todos los clientes
  @Get()
  async findAll() {
    return this.clientsService.findAll();
  }

  // ✅ Buscar cliente por DNI (autocompletado o búsqueda rápida)
  @Get('search/by-dni')
  async searchByDni(@Query('dni') dni: string) {
    if (!dni || dni.trim() === '') {
      throw new BadRequestException('Debe ingresar un DNI para buscar.');
    }
    return this.clientsService.searchByDni(dni);
  }

  // ✅ Obtener cliente por ID
  @Get(':id')
  async findOne(@Param('id') id: number) {
    const client = await this.clientsService.findOne(id);
    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado.`);
    }
    return client;
  }

  // ✅ Actualizar cliente
  @Put(':id')
  async update(@Param('id') id: number, @Body() data: UpdateClientDto) {
    try {
      return await this.clientsService.update(id, data);
    } catch (error) {
      if (error.response?.message) throw error;
      throw new BadRequestException('Error al actualizar el cliente.');
    }
  }

  // ✅ Eliminar cliente
  @Delete(':id')
  async remove(@Param('id') id: number) {
    try {
      return await this.clientsService.remove(id);
    } catch (error) {
      if (error.response?.message) throw error;
      throw new BadRequestException('Error al eliminar el cliente.');
    }
  }
}
