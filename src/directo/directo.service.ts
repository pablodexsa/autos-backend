import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { DirectoLead } from './directo-lead.entity';
import { ConsultDirectoDto } from './dto/consult-directo.dto';
import { CreateDirectoLeadDto } from './dto/create-directo-lead.dto';
import { UpdateDirectoLeadDto } from './dto/update-directo-lead.dto';
import { ListDirectoLeadsDto } from './dto/list-directo-leads.dto';
import { DirectoSaleType } from './enums/directo-sale-type.enum';
import { DirectoLeadStatus } from './enums/directo-lead-status.enum';
import type { DirectoProvider } from './interfaces/directo-provider.interface';

@Injectable()
export class DirectoService {
  constructor(
    @InjectRepository(DirectoLead)
    private readonly directoLeadRepository: Repository<DirectoLead>,

    @Inject('DIRECTO_PROVIDER')
    private readonly directoProvider: DirectoProvider,
  ) {}

  private normalizeDni(dni: string): string {
    return String(dni || '').replace(/\D/g, '').trim();
  }

  async create(createDto: CreateDirectoLeadDto, userId?: number) {
    const lead = this.directoLeadRepository.create({
      dni: this.normalizeDni(createDto.dni),
      gender: createDto.gender,
      saleType: createDto.saleType || DirectoSaleType.MOTO,
      fullName: createDto.fullName || null,
      phone: createDto.phone || null,
      email: createDto.email || null,
      address: createDto.address || null,
      observations: createDto.observations || null,
      requestedByUserId: userId || null,
      status: DirectoLeadStatus.PENDING,
    });

    return this.directoLeadRepository.save(lead);
  }

  async consult(dto: ConsultDirectoDto, userId?: number) {
    const dni = this.normalizeDni(dto.dni);

    if (!dni || dni.length < 7 || dni.length > 8) {
      throw new BadRequestException(
        'El DNI debe contener entre 7 y 8 dígitos numéricos.',
      );
    }

    const providerResult = await this.directoProvider.consult({
      dni,
      gender: dto.gender,
      saleType: 'moto',
    });

    const lead = this.directoLeadRepository.create({
      dni,
      gender: dto.gender,
      saleType: DirectoSaleType.MOTO,
      status: providerResult.status,
      fullName: providerResult.fullName || null,
      maxApprovedAmount:
        providerResult.maxApprovedAmount !== undefined &&
        providerResult.maxApprovedAmount !== null
          ? providerResult.maxApprovedAmount.toFixed(2)
          : null,
      statusMessage: providerResult.message || null,
      externalReference: providerResult.externalReference || null,
      rawResponse: providerResult.rawResponse || null,
      validatedAt: new Date(),
      requestedByUserId: userId || null,
    });

    const savedLead = await this.directoLeadRepository.save(lead);

    return {
      id: savedLead.id,
      success: providerResult.success,
      status: savedLead.status,
      fullName: savedLead.fullName,
      maxApprovedAmount: savedLead.maxApprovedAmount
        ? Number(savedLead.maxApprovedAmount)
        : null,
      message: savedLead.statusMessage,
      validatedAt: savedLead.validatedAt,
    };
  }

  async update(id: number, updateDto: UpdateDirectoLeadDto) {
    const lead = await this.findOne(id);

    if (updateDto.dni !== undefined) {
      lead.dni = this.normalizeDni(updateDto.dni);
    }

    if (updateDto.gender !== undefined) {
      lead.gender = updateDto.gender;
    }

    if (updateDto.saleType !== undefined) {
      lead.saleType = updateDto.saleType;
    }

    if (updateDto.fullName !== undefined) {
      lead.fullName = updateDto.fullName || null;
    }

    if (updateDto.phone !== undefined) {
      lead.phone = updateDto.phone || null;
    }

    if (updateDto.email !== undefined) {
      lead.email = updateDto.email || null;
    }

    if (updateDto.address !== undefined) {
      lead.address = updateDto.address || null;
    }

    if (updateDto.observations !== undefined) {
      lead.observations = updateDto.observations || null;
    }

    return this.directoLeadRepository.save(lead);
  }

  async findAll(query: ListDirectoLeadsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.directoLeadRepository
      .createQueryBuilder('lead')
      .orderBy('lead.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      const search = `%${query.search.trim()}%`;

      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('lead.dni ILIKE :search', { search })
            .orWhere('lead.fullName ILIKE :search', { search })
            .orWhere('lead.phone ILIKE :search', { search })
            .orWhere('lead.email ILIKE :search', { search });
        }),
      );
    }

    if (query.status) {
      qb.andWhere('lead.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('lead.createdAt >= :dateFrom', {
        dateFrom: `${query.dateFrom} 00:00:00`,
      });
    }

    if (query.dateTo) {
      qb.andWhere('lead.createdAt <= :dateTo', {
        dateTo: `${query.dateTo} 23:59:59`,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => ({
        ...item,
        maxApprovedAmount: item.maxApprovedAmount
          ? Number(item.maxApprovedAmount)
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const lead = await this.directoLeadRepository.findOne({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead de Directo no encontrado.');
    }

    return lead;
  }

  async getOne(id: number) {
    const lead = await this.findOne(id);

    return {
      ...lead,
      maxApprovedAmount: lead.maxApprovedAmount
        ? Number(lead.maxApprovedAmount)
        : null,
    };
  }

  async recheck(id: number, userId?: number) {
    const lead = await this.findOne(id);

    const providerResult = await this.directoProvider.consult({
      dni: lead.dni,
      gender: lead.gender,
      saleType: 'moto',
    });

    lead.status = providerResult.status;
    lead.fullName = providerResult.fullName || lead.fullName || null;
    lead.maxApprovedAmount =
      providerResult.maxApprovedAmount !== undefined &&
      providerResult.maxApprovedAmount !== null
        ? providerResult.maxApprovedAmount.toFixed(2)
        : null;
    lead.statusMessage = providerResult.message || null;
    lead.externalReference = providerResult.externalReference || null;
    lead.rawResponse = providerResult.rawResponse || null;
    lead.validatedAt = new Date();

    if (userId) {
      lead.requestedByUserId = userId;
    }

    const saved = await this.directoLeadRepository.save(lead);

    return {
      id: saved.id,
      status: saved.status,
      fullName: saved.fullName,
      maxApprovedAmount: saved.maxApprovedAmount
        ? Number(saved.maxApprovedAmount)
        : null,
      message: saved.statusMessage,
      validatedAt: saved.validatedAt,
    };
  }

  async remove(id: number) {
    const lead = await this.findOne(id);
    await this.directoLeadRepository.remove(lead);
    return { success: true };
  }
}