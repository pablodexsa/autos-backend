import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  // ✅ Crear nuevo cliente con validaciones
  async create(data: CreateClientDto): Promise<Client> {
    if (!data.firstName || !data.lastName || !data.dni) {
      throw new BadRequestException('Nombre, apellido y DNI son obligatorios.');
    }

    // Verificar duplicados
    const existing = await this.clientsRepository.findOne({
      where: [{ dni: data.dni }, { email: data.email }],
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un cliente con ese DNI o correo electrónico.',
      );
    }

    const client = this.clientsRepository.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      dni: data.dni,
      address: data.address,
      phone: data.phone,
      email: data.email,
    });

    return this.clientsRepository.save(client);
  }

  // ✅ Listar todos los clientes
  async findAll(): Promise<Client[]> {
    return this.clientsRepository.find({
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  // ✅ Buscar un cliente por ID
  async findOne(id: number): Promise<Client> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Cliente no encontrado.');
    return client;
  }

  // ✅ Actualizar cliente existente
  async update(id: number, data: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    if (data.firstName) client.firstName = data.firstName.trim();
    if (data.lastName) client.lastName = data.lastName.trim();
    if (data.dni) client.dni = data.dni;
    if (data.email) client.email = data.email;
    if (data.phone) client.phone = data.phone;
    if (data.address) client.address = data.address;

    return this.clientsRepository.save(client);
  }

  // ✅ Eliminar cliente
  async remove(id: number): Promise<{ id: number }> {
    const client = await this.findOne(id);
    await this.clientsRepository.remove(client);
    return { id };
  }

  // ✅ Buscar cliente por DNI (autocompletado)
  async searchByDni(dni: string): Promise<Client[]> {
    return this.clientsRepository.find({
      where: { dni: Like(`${dni}%`) },
      take: 5,
      order: { dni: 'ASC' },
    });
  }
}
