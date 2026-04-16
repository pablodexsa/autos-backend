import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JudicialExecution, JudicialExecutionStatus } from './judicial-execution.entity';
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

  async preview(clientId: number): Promise<JudicialExecutionPreviewDto> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const activeExisting = await this.judicialRepo.findOne({
      where: {
        clientId,
        status: JudicialExecutionStatus.ACTIVE,
      },
    });

    if (activeExisting) {
      throw new BadRequestException(
        'El cliente ya posee una ejecución judicial activa.',
      );
    }

    const qb = this.installmentRepo
      .createQueryBuilder('i')
      .where('i.clientId = :clientId', { clientId })
      .andWhere('COALESCE(i.remainingAmount, 0) > 0')
      .andWhere('COALESCE(i.isJudicialized, false) = false')
      .orderBy('i.dueDate', 'ASC');

    const installments = await qb.getMany();

    if (!installments.length) {
      throw new BadRequestException(
        'El cliente no tiene cuotas impagas para judicializar.',
      );
    }

    const mappedInstallments = installments.map((installment) => {
      const judicialNetAmount = this.getPurePendingAmount(installment);

      return {
        id: installment.id,
        saleId: (installment as any).saleId ?? null,
        dueDate: (installment as any).dueDate
          ? new Date((installment as any).dueDate).toISOString()
          : null,
        amount: this.toNumber((installment as any).amount),
        remainingAmount: this.toNumber((installment as any).remainingAmount),
        judicialNetAmount,
      };
    });

    const executedNetAmount = mappedInstallments.reduce(
      (acc, item) => acc + item.judicialNetAmount,
      0,
    );

    return {
      clientId,
      clientName:
        (client as any).fullName ||
        (client as any).name ||
        `${(client as any).firstName ?? ''} ${(client as any).lastName ?? ''}`.trim(),
      installmentsCount: mappedInstallments.length,
      executedNetAmount,
      installments: mappedInstallments,
    };
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

      const activeExisting = await judicialRepo.findOne({
        where: {
          clientId: dto.clientId,
          status: JudicialExecutionStatus.ACTIVE,
        },
      });

      if (activeExisting) {
        throw new BadRequestException(
          'El cliente ya posee una ejecución judicial activa.',
        );
      }

      const installments = await installmentRepo
        .createQueryBuilder('i')
        .where('i.clientId = :clientId', { clientId: dto.clientId })
        .andWhere('COALESCE(i.remainingAmount, 0) > 0')
        .andWhere('COALESCE(i.isJudicialized, false) = false')
        .orderBy('i.dueDate', 'ASC')
        .getMany();

      if (!installments.length) {
        throw new BadRequestException(
          'El cliente no tiene cuotas impagas para judicializar.',
        );
      }

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
        installment.judicialNetAmount = Number(judicialNetAmounts[index].toFixed(2));
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
        installments: true,
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