import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { LoanClient } from './loan-client.entity';
import { CreateLoanClientDto } from './dto/create-loan-client.dto';
import { UpdateLoanClientDto } from './dto/update-loan-client.dto';

export type LoanClientDocType =
  | 'dni'
  | 'business'
  | 'service_bill'
  | 'bank_account';

@Injectable()
export class LoanClientsService {
  constructor(
    @InjectRepository(LoanClient)
    private readonly loanClientsRepo: Repository<LoanClient>,
  ) {}

  async create(data: CreateLoanClientDto): Promise<LoanClient> {
    if (!data.firstName || !data.lastName || !data.cuitCuil) {
      throw new BadRequestException(
        'Nombre, apellido y CUIT/CUIL son obligatorios.',
      );
    }

    const existing = await this.loanClientsRepo.findOne({
      where: { cuitCuil: data.cuitCuil },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un cliente de préstamo con ese CUIT/CUIL.',
      );
    }

    const client = this.loanClientsRepo.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      cuitCuil: data.cuitCuil.trim(),
      workAddress: data.workAddress?.trim() || null,
      aliasOrCbu: data.aliasOrCbu?.trim() || null,
      dniPhotoPath: null,
      businessPhotoPath: null,
      serviceBillPath: null,
      bankAccountPath: null,
    });

    return this.loanClientsRepo.save(client);
  }

  async findAll(filters?: {
    q?: string;
    cuitCuil?: string;
    firstName?: string;
    lastName?: string;
    aliasOrCbu?: string;
  }): Promise<LoanClient[]> {
    const qb = this.loanClientsRepo
      .createQueryBuilder('client')
      .orderBy('client.lastName', 'ASC')
      .addOrderBy('client.firstName', 'ASC');

    if (filters?.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      qb.andWhere(
        `(client.firstName ILIKE :q OR client.lastName ILIKE :q OR client.cuitCuil ILIKE :q OR client.aliasOrCbu ILIKE :q)`,
        { q },
      );
    }

    if (filters?.cuitCuil?.trim()) {
      qb.andWhere('client.cuitCuil ILIKE :cuitCuil', {
        cuitCuil: `%${filters.cuitCuil.trim()}%`,
      });
    }

    if (filters?.firstName?.trim()) {
      qb.andWhere('client.firstName ILIKE :firstName', {
        firstName: `%${filters.firstName.trim()}%`,
      });
    }

    if (filters?.lastName?.trim()) {
      qb.andWhere('client.lastName ILIKE :lastName', {
        lastName: `%${filters.lastName.trim()}%`,
      });
    }

    if (filters?.aliasOrCbu?.trim()) {
      qb.andWhere('client.aliasOrCbu ILIKE :aliasOrCbu', {
        aliasOrCbu: `%${filters.aliasOrCbu.trim()}%`,
      });
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<LoanClient> {
    const client = await this.loanClientsRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Cliente de préstamo no encontrado.');
    }
    return client;
  }

  async searchByCuitCuil(cuitCuil: string): Promise<LoanClient[]> {
    return this.loanClientsRepo.find({
      where: { cuitCuil: Like(`${cuitCuil}%`) },
      take: 5,
      order: { cuitCuil: 'ASC' },
    });
  }

  async update(id: number, data: UpdateLoanClientDto): Promise<LoanClient> {
    const client = await this.findOne(id);

    if (data.firstName !== undefined) client.firstName = data.firstName.trim();
    if (data.lastName !== undefined) client.lastName = data.lastName.trim();
    if (data.cuitCuil !== undefined) client.cuitCuil = data.cuitCuil.trim();
    if (data.workAddress !== undefined) {
      client.workAddress = data.workAddress?.trim() || null;
    }
    if (data.aliasOrCbu !== undefined) {
      client.aliasOrCbu = data.aliasOrCbu?.trim() || null;
    }

    return this.loanClientsRepo.save(client);
  }

  async remove(id: number): Promise<{ id: number }> {
    const client = await this.findOne(id);
    await this.loanClientsRepo.remove(client);
    return { id };
  }

  async attachDocument(
    id: number,
    docType: LoanClientDocType,
    url: string,
  ): Promise<LoanClient> {
    const client = await this.findOne(id);

    switch (docType) {
      case 'dni':
        client.dniPhotoPath = url;
        break;
      case 'business':
        client.businessPhotoPath = url;
        break;
      case 'service_bill':
        client.serviceBillPath = url;
        break;
      case 'bank_account':
        client.bankAccountPath = url;
        break;
      default:
        throw new BadRequestException('Tipo de documento inválido.');
    }

    return this.loanClientsRepo.save(client);
  }

  async getDocumentUrl(id: number, docType: LoanClientDocType): Promise<string> {
    const client = await this.findOne(id);

    const url =
      docType === 'dni'
        ? client.dniPhotoPath
        : docType === 'business'
          ? client.businessPhotoPath
          : docType === 'service_bill'
            ? client.serviceBillPath
            : client.bankAccountPath;

    if (!url) {
      throw new NotFoundException('Documento no encontrado.');
    }

    return url;
  }
}