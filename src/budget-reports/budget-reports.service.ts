import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BudgetReport } from './budget-report.entity';
import { CreateBudgetReportDto } from './dto/create-budget-report.dto';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';

@Injectable()
export class BudgetReportsService {
  constructor(
    @InjectRepository(BudgetReport)
    private repo: Repository<BudgetReport>,
    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateBudgetReportDto): Promise<BudgetReport> {
    console.log('📥 DTO recibido en backend:', dto);

    // 🔍 Verificar existencia de vehículo
    const vehicle = await this.vehicleRepo.findOne({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // 🔍 Verificar existencia de cliente
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    // 🔍 Vendedor (opcional)
    let seller: User | undefined = undefined;
    if (dto.sellerId) {
      const user = await this.userRepo.findOne({ where: { id: dto.sellerId } });
      if (user) seller = user;
      else console.warn(`⚠️ Seller ID ${dto.sellerId} no encontrado`);
    }

    // 🧩 Mostrar tipos
    console.log('🔎 Tipos de datos recibidos:', {
      vehicleId: typeof dto.vehicleId,
      clientId: typeof dto.clientId,
      sellerId: typeof dto.sellerId,
      listPrice: typeof dto.listPrice,
      finalPrice: typeof dto.finalPrice,
      installmentValue: typeof dto.installmentValue,
      downPayment: typeof dto.downPayment,
    });

    // 🧾 Crear registro del reporte
    const report = new BudgetReport();
    report.vehicle = vehicle;
    report.client = client;
    if (seller) report.seller = seller;

// 🔗 Vincular presupuesto original
report.budgetId = dto.budgetId ?? undefined;

// 💰 Cargar datos numéricos (asegurando tipo number)
report.paymentType = dto.paymentType;
report.installments = dto.installments ?? undefined;
report.listPrice = Number(dto.listPrice) || 0;
report.finalPrice = Number(dto.finalPrice) || 0;
report.installmentValue =
  dto.installmentValue != null ? Number(dto.installmentValue) : undefined;
report.downPayment =
  dto.downPayment != null ? Number(dto.downPayment) : undefined;


    try {
      const saved = await this.repo.save(report);
      console.log('✅ Presupuesto guardado correctamente con ID:', saved.id);
      return saved;
    } catch (error) {
      console.error('❌ Error al guardar BudgetReport:', error);
      throw error;
    }
  }

  async findAll(filters: {
    plate?: string;
    dni?: string;
    seller?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<BudgetReport[]> {
    const qb = this.repo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.vehicle', 'v')
      .leftJoinAndSelect('b.client', 'c')
      .leftJoinAndSelect('b.seller', 's')
      .orderBy('b.createdAt', 'DESC');

    if (filters.plate)
      qb.andWhere('LOWER(v.plate) LIKE :plate', {
        plate: `%${filters.plate.toLowerCase()}%`,
      });

    if (filters.dni)
      qb.andWhere('c.dni LIKE :dni', { dni: `%${filters.dni}%` });

    if (filters.seller)
      qb.andWhere('LOWER(s.name) LIKE :seller', {
        seller: `%${filters.seller.toLowerCase()}%`,
      });

    if (filters.startDate && filters.endDate)
      qb.andWhere('b.createdAt BETWEEN :start AND :end', {
        start: new Date(filters.startDate),
        end: new Date(filters.endDate),
      });

    return qb.getMany();
  }
}
