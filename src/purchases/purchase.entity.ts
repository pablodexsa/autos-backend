import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';

@Entity({ name: 'purchases' })
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @ManyToOne(() => Client, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number; // 💰 precio de la compra

  @CreateDateColumn()
  createdAt: Date;
}
