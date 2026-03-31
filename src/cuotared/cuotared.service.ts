import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CuotaRedLead } from './cuotared-lead.entity';
import { ConsultCuotaRedDto } from './dto/consult-cuotared.dto';
import { UpdateCuotaRedDto } from './dto/update-cuotared.dto';
import { ListCuotaRedLeadsDto } from './dto/list-cuotared-leads.dto';
import { CuotaRedLeadStatus } from './enums/cuotared-lead-status.enum';
import type { CuotaRedProvider } from './interfaces/cuotared-provider.interface';

@Injectable()
export class CuotaRedService {
  constructor(
    @InjectRepository(CuotaRedLead)
    private readonly cuotaRedLeadRepository: Repository<CuotaRedLead>,

    @Inject('CUOTARED_PROVIDER')
    private readonly cuotaRedProvider: CuotaRedProvider,
  ) {}

  private normalizeDni(dni: string): string {
    return String(dni || '').replace(/\D/g, '').trim();
  }

  async consult(dto: ConsultCuotaRedDto) {
    const dni = this.normalizeDni(dto.dni);

    if (!dni || dni.length < 7 || dni.length > 8) {
      throw new BadRequestException(
        'El DNI debe contener entre 7 y 8 dígitos numéricos.',
      );
    }

    const providerResult = await this.cuotaRedProvider.consult({
      dni,
      gender: dto.gender,
    });

const lead = this.cuotaRedLeadRepository.create({
  dni,
  gender: dto.gender,
  status: providerResult.status,
  maxApprovedAmount:
    providerResult.maxApprovedAmount !== undefined &&
    providerResult.maxApprovedAmount !== null
      ? providerResult.maxApprovedAmount.toFixed(2)
      : null,
  statusMessage: providerResult.message || null,
  rawResponse: providerResult.rawResponse || null,
  validatedAt: new Date(),

  // ✅ CORRECTO
  firstName: providerResult.firstName || null,
  lastName: providerResult.lastName || null,
  fullName: providerResult.fullName || null,
});

    const savedLead = await this.cuotaRedLeadRepository.save(lead);

    return {
      id: savedLead.id,
      success: providerResult.success,
      status: savedLead.status,
      maxApprovedAmount: savedLead.maxApprovedAmount
        ? Number(savedLead.maxApprovedAmount)
        : null,
      message: savedLead.statusMessage,
      validatedAt: savedLead.validatedAt,
    };
  }

  async findAll(query: ListCuotaRedLeadsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.cuotaRedLeadRepository
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
            .orWhere('lead.phone ILIKE :search', { search })
            .orWhere('lead.email ILIKE :search', { search })
            .orWhere('lead.statusMessage ILIKE :search', { search });
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
    const lead = await this.cuotaRedLeadRepository.findOne({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead de Cuota Red no encontrado.');
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

  async update(id: number, updateDto: UpdateCuotaRedDto) {
    const lead = await this.findOne(id);

    if (updateDto.phone !== undefined) {
      lead.phone = updateDto.phone || null;
    }

    if (updateDto.email !== undefined) {
      lead.email = updateDto.email || null;
    }

    const saved = await this.cuotaRedLeadRepository.save(lead);

    return {
      ...saved,
      maxApprovedAmount: saved.maxApprovedAmount
        ? Number(saved.maxApprovedAmount)
        : null,
    };
  }

async recheck(id: number) {
  const lead = await this.findOne(id);

  const providerResult = await this.cuotaRedProvider.consult({
    dni: lead.dni,
    gender: lead.gender as any,
  });

  lead.status = providerResult.status;
  lead.maxApprovedAmount =
    providerResult.maxApprovedAmount !== undefined &&
    providerResult.maxApprovedAmount !== null
      ? providerResult.maxApprovedAmount.toFixed(2)
      : null;
  lead.statusMessage = providerResult.message || null;
  lead.rawResponse = providerResult.rawResponse || null;
  lead.validatedAt = new Date();
  lead.firstName = providerResult.firstName || null;
  lead.lastName = providerResult.lastName || null;
  lead.fullName = providerResult.fullName || null;

  const saved = await this.cuotaRedLeadRepository.save(lead);

  return {
    id: saved.id,
    success: providerResult.success,
    status: saved.status,
    maxApprovedAmount: saved.maxApprovedAmount
      ? Number(saved.maxApprovedAmount)
      : null,
    message: saved.statusMessage,
    validatedAt: saved.validatedAt,
  };
}

  async remove(id: number) {
    const lead = await this.findOne(id);
    await this.cuotaRedLeadRepository.remove(lead);
    return { success: true };
  }
}