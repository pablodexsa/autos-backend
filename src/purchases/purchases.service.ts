import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Purchase, AcquisitionType } from './purchase.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { TreasuryService } from '../treasury/treasury.service';
import { TreasuryCompany, TreasuryMovementType } from '../treasury/treasury.enums';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase) private readonly purchasesRepository: Repository<Purchase>,
    @InjectRepository(Vehicle) private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Client) private readonly clientsRepository: Repository<Client>,
    private readonly dataSource: DataSource,
    private readonly treasuryService: TreasuryService,
  ) {}

  async findAll() {
    return this.purchasesRepository.find({ relations: ['vehicle', 'client'], order: { id: 'DESC' } });
  }

  async findOne(id: number) {
    const purchase = await this.purchasesRepository.findOne({ where: { id }, relations: ['vehicle', 'client'] });
    if (!purchase) throw new NotFoundException('Compra no encontrada');
    return purchase;
  }

  async create(data: CreatePurchaseDto, userId: number) {
    const vehicle = await this.vehiclesRepository.findOne({ where: { id: Number(data.vehicleId) } });
    if (!vehicle) throw new BadRequestException('Vehículo no encontrado');

    const type = data.acquisitionType;
    const requiresCashOut = type === AcquisitionType.DEALER_PURCHASE || type === AcquisitionType.PRIVATE_PURCHASE;
    const requiresClient = type === AcquisitionType.PRIVATE_PURCHASE || type === AcquisitionType.TRADE_IN || type === AcquisitionType.CONSIGNMENT;

    let client: Client | null = null;
    if (requiresClient) {
      if (!data.clientId) throw new BadRequestException('Debe seleccionar la persona/cliente de la operación');
      client = await this.clientsRepository.findOne({ where: { id: Number(data.clientId) } });
      if (!client) throw new BadRequestException('Cliente/persona no encontrado');
    }

    if (type === AcquisitionType.DEALER_PURCHASE && !data.supplierName?.trim()) {
      throw new BadRequestException('Debe indicar la agencia/proveedor');
    }
    if (type === AcquisitionType.TRADE_IN && !data.relatedSaleId) {
      throw new BadRequestException('Debe indicar la venta asociada a la parte de pago');
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El valor de adquisición debe ser mayor a cero');

    const allocations = data.treasuryAllocations ?? [];
    if (requiresCashOut) {
      if (!allocations.length) throw new BadRequestException('Debe indicar desde qué cuenta/s de GL Motors se pagó la compra');
      const total = allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      if (Math.abs(total - amount) > 0.01) throw new BadRequestException('La distribución de Tesorería debe coincidir con el monto de la compra');
    } else if (allocations.length) {
      throw new BadRequestException('Parte de pago y consignación no generan egreso de Tesorería al registrar el vehículo');
    }

    return this.dataSource.transaction(async (manager) => {
      const purchase = await manager.save(manager.create(Purchase, {
        vehicle,
        client,
        acquisitionType: type,
        supplierName: type === AcquisitionType.DEALER_PURCHASE ? data.supplierName!.trim() : null,
        relatedSaleId: type === AcquisitionType.TRADE_IN ? Number(data.relatedSaleId) : null,
        amount,
      }));

      if (requiresCashOut) {
        const counterparty = type === AcquisitionType.DEALER_PURCHASE
          ? data.supplierName!.trim()
          : `${client?.firstName ?? ''} ${client?.lastName ?? ''}`.trim();
        await this.treasuryService.createAutomaticMovementWithAllocations(manager, {
          company: TreasuryCompany.GL_MOTORS,
          type: TreasuryMovementType.EXPENSE,
          movementDate: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date()),
          allocations: allocations.map((item) => ({ accountId: Number(item.accountId), amount: Number(item.amount), paymentMethod: item.paymentMethod, reference: item.reference ?? null })),
          description: `Compra de vehículo #${vehicle.id}`,
          sourceType: 'VEHICLE_PURCHASE',
          sourceId: purchase.id,
          createdBy: userId,
          reference: `Compra #${purchase.id}`,
          counterparty,
          clientId: client?.id ?? null,
        });
      }
      return this.findOneWithManager(manager, purchase.id);
    });
  }

  private async findOneWithManager(manager: any, id: number) {
    return manager.getRepository(Purchase).findOne({ where: { id }, relations: ['vehicle', 'client'] });
  }

  async remove(_id: number) {
    throw new BadRequestException('Las adquisiciones registradas no se eliminan: deben anularse mediante un circuito contable para preservar Tesorería y auditoría');
  }
}
