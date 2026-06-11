import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import {
  KairosLead,
  KairosLeadSource,
  KairosLeadStatus,
} from './kairos-lead.entity';
import { CreateKairosLeadDto } from './dto/create-kairos-lead.dto';
import { UpdateKairosLeadDto } from './dto/update-kairos-lead.dto';
import { BcraService } from './bcra.service';
import { CreatePublicKairosLeadDto } from './dto/create-public-kairos-lead.dto';

interface FindAllKairosLeadsParams {
  q?: string;
  status?: KairosLeadStatus;
  source?: KairosLeadSource;
  page?: number;
  limit?: number;
}

@Injectable()
export class KairosLeadsService {
  constructor(
    @InjectRepository(KairosLead)
    private readonly kairosLeadRepository: Repository<KairosLead>,
    private readonly bcraService: BcraService,
  ) {}

  private normalizeCuitCuil(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  async create(dto: CreateKairosLeadDto): Promise<KairosLead> {
    const lead = this.kairosLeadRepository.create({
      ...dto,
      cuitCuil: this.normalizeCuitCuil(dto.cuitCuil),
      source: dto.source ?? KairosLeadSource.MANUAL,
      status: dto.status ?? KairosLeadStatus.NEW,
    });

    return this.kairosLeadRepository.save(lead);
  }

  async findAll(params: FindAllKairosLeadsParams) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any[] = [];
    const baseWhere: any = {};

    if (params.status) baseWhere.status = params.status;
    if (params.source) baseWhere.source = params.source;

    if (params.q?.trim()) {
      const q = `%${params.q.trim()}%`;

      where.push(
        { ...baseWhere, fullName: ILike(q) },
        { ...baseWhere, cuitCuil: ILike(q) },
        { ...baseWhere, phone: ILike(q) },
        { ...baseWhere, businessAddress: ILike(q) },
        { ...baseWhere, businessType: ILike(q) },
      );
    }

    const [items, total] = await this.kairosLeadRepository.findAndCount({
      where: where.length > 0 ? where : baseWhere,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<KairosLead> {
    const lead = await this.kairosLeadRepository.findOne({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead de Kairos no encontrado');
    }

    return lead;
  }

  async update(id: number, dto: UpdateKairosLeadDto): Promise<KairosLead> {
    const lead = await this.findOne(id);

    Object.assign(lead, {
      ...dto,
      cuitCuil: dto.cuitCuil
        ? this.normalizeCuitCuil(dto.cuitCuil)
        : lead.cuitCuil,
    });

    return this.kairosLeadRepository.save(lead);
  }

  async remove(id: number): Promise<{ success: true }> {
    const lead = await this.findOne(id);

    await this.kairosLeadRepository.remove(lead);

    return { success: true };
  }

  async updateStatus(
    id: number,
    status: KairosLeadStatus,
  ): Promise<KairosLead> {
    const lead = await this.findOne(id);

    lead.status = status;

    return this.kairosLeadRepository.save(lead);
  }

  async checkBcra(id: number): Promise<KairosLead> {
    const lead = await this.findOne(id);

    const result = await this.bcraService.getDebtorInfo(lead.cuitCuil);
    const summary = this.bcraService.summarizeDebtorInfo(result);

    lead.bcraStatus = summary;
    lead.bcraRawResult = result;

    return this.kairosLeadRepository.save(lead);
  }

  async createPublic(dto: CreatePublicKairosLeadDto): Promise<KairosLead> {
    const normalizedCuitCuil = this.normalizeCuitCuil(dto.cuitCuil);

    const openStatuses = [
      KairosLeadStatus.NEW,
      KairosLeadStatus.CONTACTED,
      KairosLeadStatus.IN_ANALYSIS,
      KairosLeadStatus.PRE_APPROVED,
    ];

    const existingLead = await this.kairosLeadRepository.findOne({
      where: {
        cuitCuil: normalizedCuitCuil,
        status: In(openStatuses),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (existingLead) {
      existingLead.fullName = dto.fullName;
      existingLead.phone = dto.phone;
      existingLead.businessAddress = dto.businessAddress;
      existingLead.businessType = dto.businessType || null;
      existingLead.businessAge = dto.businessAge || null;
      existingLead.requestedAmount = dto.requestedAmount;
      existingLead.campaign = dto.campaign || existingLead.campaign || null;
      existingLead.adName = dto.adName || existingLead.adName || null;
      existingLead.utmSource = dto.utmSource || existingLead.utmSource || null;
      existingLead.utmCampaign = dto.utmCampaign || existingLead.utmCampaign || null;
      existingLead.utmContent = dto.utmContent || existingLead.utmContent || null;
      existingLead.source = KairosLeadSource.META_ADS;

      const previousNotes = existingLead.notes?.trim();
      const duplicateNote = `Lead actualizado desde WhatsApp / publicidad. Fecha: ${new Date().toISOString()}.`;

      existingLead.notes = previousNotes
        ? `${previousNotes}\n${duplicateNote}`
        : duplicateNote;

      return this.kairosLeadRepository.save(existingLead);
    }

    const lead = this.kairosLeadRepository.create({
      fullName: dto.fullName,
      cuitCuil: normalizedCuitCuil,
      phone: dto.phone,
      businessAddress: dto.businessAddress,
      businessType: dto.businessType || null,
      businessAge: dto.businessAge || null,
      requestedAmount: dto.requestedAmount,
      campaign: dto.campaign || null,
      adName: dto.adName || null,
      utmSource: dto.utmSource || null,
      utmCampaign: dto.utmCampaign || null,
      utmContent: dto.utmContent || null,
      source: KairosLeadSource.META_ADS,
      status: KairosLeadStatus.NEW,
      notes: 'Lead ingresado desde WhatsApp / publicidad.',
    });

    return this.kairosLeadRepository.save(lead);
  }
}