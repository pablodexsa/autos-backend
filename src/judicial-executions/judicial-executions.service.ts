import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  JudicialExecution,
  JudicialExecutionStatus,
} from './judicial-execution.entity';
import { CreateJudicialExecutionDto } from './dto/create-judicial-execution.dto';
import { Client } from '../clients/entities/client.entity';
import { Installment } from '../installments/installment.entity';
import { JudicialExecutionPreviewDto } from './dto/judicial-execution-preview.dto';

@Injectable()
export class JudicialExecutionsService {
  constructor(
    @InjectRepository(JudicialExecution)
    private readonly judicialRepo: Repository<JudicialExecution>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    private readonly dataSource: DataSource,
  ) {}

  private toNumber(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Regla actual:
   * - se toma solo deuda neta/pura
   * - sin intereses
   * - si remainingAmount hoy ya representa saldo puro pendiente, usamos eso
   */
  private getPurePendingAmount(installment: Installment): number {
    const remaining = this.toNumber((installment as any).remainingAmount);
    if (remaining <= 0) return 0;
    return remaining;
  }

  private getClientDisplayName(client: any): string {
    return (
      client?.fullName ||
      client?.name ||
      `${client?.firstName ?? ''} ${client?.lastName ?? ''}`.trim()
    );
  }

  private normalizeSaleIds(saleIds: number[]): number[] {
    return [
      ...new Set(
        (saleIds || [])
          .map(Number)
          .filter((v) => Number.isInteger(v) && v > 0),
      ),
    ];
  }

  private async getEligibleInstallmentsBySales(
    installmentRepo: Repository<Installment>,
    clientId: number,
    saleIds: number[],
  ) {
    const normalizedSaleIds = this.normalizeSaleIds(saleIds);

    if (!normalizedSaleIds.length) {
      throw new BadRequestException(
        'Debe seleccionar al menos un vehículo/operación.',
      );
    }

    const installments = await installmentRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.sale', 'sale')
      .innerJoinAndSelect('sale.vehicle', 'vehicle')
      .where('i.clientId = :clientId', { clientId })
      .andWhere('i.saleId IN (:...saleIds)', { saleIds: normalizedSaleIds })
      .andWhere('COALESCE(i.remainingAmount, 0) > 0')
      .andWhere('COALESCE(i.isJudicialized, false) = false')
      .orderBy('vehicle.plate', 'ASC')
      .addOrderBy('i.dueDate', 'ASC')
      .getMany();

    if (!installments.length) {
      throw new BadRequestException(
        'No se encontraron cuotas impagas para los vehículos seleccionados.',
      );
    }

    const foundSaleIds = [
      ...new Set(installments.map((i) => Number(i.saleId))),
    ];

    if (foundSaleIds.length !== normalizedSaleIds.length) {
      throw new BadRequestException(
        'Una o más operaciones seleccionadas no pertenecen al cliente o no tienen deuda judicializable.',
      );
    }

    return installments;
  }

  async findClientSales(clientId: number) {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const raw = await this.installmentRepo
      .createQueryBuilder('i')
      .innerJoin('i.sale', 'sale')
      .innerJoin('sale.vehicle', 'vehicle')
      .where('i.clientId = :clientId', { clientId })
      .andWhere('COALESCE(i.remainingAmount, 0) > 0')
      .andWhere('COALESCE(i.isJudicialized, false) = false')
      .select('sale.id', 'saleId')
      .addSelect('sale.createdAt', 'saleCreatedAt')
      .addSelect('vehicle.id', 'vehicleId')
      .addSelect('vehicle.plate', 'plate')
      .addSelect('vehicle.brand', 'brand')
      .addSelect('vehicle.model', 'model')
      .addSelect('vehicle.versionName', 'versionName')
      .addSelect('COUNT(i.id)', 'installmentsCount')
      .addSelect('SUM(COALESCE(i.remainingAmount, 0))', 'pendingAmount')
      .groupBy('sale.id')
      .addGroupBy('sale.createdAt')
      .addGroupBy('vehicle.id')
      .addGroupBy('vehicle.plate')
      .addGroupBy('vehicle.brand')
      .addGroupBy('vehicle.model')
      .addGroupBy('vehicle.versionName')
      .orderBy('sale.createdAt', 'DESC')
      .getRawMany();

    if (!raw.length) {
      throw new BadRequestException(
        'El cliente no tiene vehículos con deuda judicializable.',
      );
    }

    return {
      clientId,
      clientName: this.getClientDisplayName(client),
      sales: raw.map((row) => ({
        saleId: Number(row.saleId),
        vehicleId: Number(row.vehicleId),
        plate: row.plate ?? null,
        vehicleLabel: [row.brand, row.model, row.versionName]
          .filter(Boolean)
          .join(' '),
        saleCreatedAt: row.saleCreatedAt
          ? new Date(row.saleCreatedAt).toISOString()
          : null,
        installmentsCount: Number(row.installmentsCount ?? 0),
        pendingAmount: Number(Number(row.pendingAmount ?? 0).toFixed(2)),
      })),
    };
  }

  async preview(
    clientId: number,
    saleIds: number[],
  ): Promise<JudicialExecutionPreviewDto> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const installments = await this.getEligibleInstallmentsBySales(
      this.installmentRepo,
      clientId,
      saleIds,
    );

    const mappedInstallments = installments.map((installment) => {
      const judicialNetAmount = this.getPurePendingAmount(installment);
      const vehicle = (installment.sale as any)?.vehicle;

      return {
        id: installment.id,
        saleId: installment.saleId ?? null,
        plate: vehicle?.plate ?? null,
        vehicleLabel: [vehicle?.brand, vehicle?.model, vehicle?.versionName]
          .filter(Boolean)
          .join(' '),
        installmentNumber: installment.installmentNumber ?? null,
        dueDate: installment.dueDate
          ? new Date(installment.dueDate).toISOString()
          : null,
        amount: this.toNumber(installment.amount),
        remainingAmount: this.toNumber(installment.remainingAmount),
        judicialNetAmount,
      };
    });

    const executedNetAmount = mappedInstallments.reduce(
      (acc, item) => acc + item.judicialNetAmount,
      0,
    );

    return {
      clientId,
      clientName: this.getClientDisplayName(client),
      selectedSaleIds: this.normalizeSaleIds(saleIds),
      installmentsCount: mappedInstallments.length,
      executedNetAmount: Number(executedNetAmount.toFixed(2)),
      installments: mappedInstallments,
    } as any;
  }

  async create(dto: CreateJudicialExecutionDto, userId?: number) {
    return this.dataSource.transaction(async (manager) => {
      const clientRepo = manager.getRepository(Client);
      const installmentRepo = manager.getRepository(Installment);
      const judicialRepo = manager.getRepository(JudicialExecution);

      const client = await clientRepo.findOne({
        where: { id: dto.clientId },
      });

      if (!client) {
        throw new NotFoundException('Cliente no encontrado.');
      }

      const installments = await this.getEligibleInstallmentsBySales(
        installmentRepo,
        dto.clientId,
        dto.saleIds ?? [],
      );

      const judicialNetAmounts = installments.map((installment) =>
        this.getPurePendingAmount(installment),
      );

      const executedNetAmount = judicialNetAmounts.reduce(
        (acc, value) => acc + value,
        0,
      );

      const judicial = judicialRepo.create({
        clientId: dto.clientId,
        status: JudicialExecutionStatus.ACTIVE,
        lawFirmName: dto.lawFirmName ?? null,
        notes: dto.notes ?? null,
        executedNetAmount: Number(executedNetAmount.toFixed(2)),
        affectedInstallmentsCount: installments.length,
        startedAt: new Date(),
        createdById: userId ?? null,
      });

      const savedJudicial: JudicialExecution = await judicialRepo.save(judicial);

      const judicializedAt = new Date();

      installments.forEach((installment, index) => {
        installment.isJudicialized = true;
        installment.judicialExecutionId = savedJudicial.id;
        installment.judicializedAt = judicializedAt;
        installment.judicialNetAmount = Number(
          judicialNetAmounts[index].toFixed(2),
        );
      });

      await installmentRepo.save(installments);

      return judicialRepo.findOne({
        where: { id: savedJudicial.id },
        relations: {
          client: true,
        } as any,
      });
    });
  }

  async findAll(q?: string) {
    const qb = this.judicialRepo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.client', 'client')
      .orderBy('j.startedAt', 'DESC');

    if (q?.trim()) {
      qb.andWhere(
        `
        (
          CAST(j.id AS TEXT) ILIKE :q
          OR COALESCE(j.lawFirmName, '') ILIKE :q
          OR COALESCE(j.notes, '') ILIKE :q
          OR COALESCE(client.fullName, '') ILIKE :q
          OR COALESCE(client.name, '') ILIKE :q
          OR COALESCE(client.dni, '') ILIKE :q
        )
        `,
        { q: `%${q.trim()}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const judicial = await this.judicialRepo.findOne({
      where: { id },
      relations: {
        client: true,
        installments: {
          sale: {
            vehicle: true,
          },
        },
      } as any,
    });

    if (!judicial) {
      throw new NotFoundException('Ejecución judicial no encontrada.');
    }

    return judicial;
  }

  async close(id: number) {
    const judicial = await this.judicialRepo.findOne({
      where: { id },
    });

    if (!judicial) {
      throw new NotFoundException('Ejecución judicial no encontrada.');
    }

    if (judicial.status === JudicialExecutionStatus.CLOSED) {
      throw new BadRequestException('La ejecución judicial ya está cerrada.');
    }

    judicial.status = JudicialExecutionStatus.CLOSED;
    return this.judicialRepo.save(judicial);
  }
}