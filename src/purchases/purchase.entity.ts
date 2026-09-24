import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';

export enum AcquisitionType {
  DEALER_PURCHASE = 'DEALER_PURCHASE',
  PRIVATE_PURCHASE = 'PRIVATE_PURCHASE',
  TRADE_IN = 'TRADE_IN',
  CONSIGNMENT = 'CONSIGNMENT',
}

@Entity({ name: 'purchases' })
export class Purchase {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @ManyToOne(() => Client, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @Column({ type: 'varchar', length: 30, default: AcquisitionType.PRIVATE_PURCHASE })
  acquisitionType: AcquisitionType;

  @Column({ type: 'varchar', length: 160, nullable: true })
  supplierName: string | null;

  @Column({ type: 'int', nullable: true })
  relatedSaleId: number | null;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn() createdAt: Date;
}
