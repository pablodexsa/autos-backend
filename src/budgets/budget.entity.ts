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

@Entity({ name: 'budgets' })
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @ManyToOne(() => Client, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column('decimal', { precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string; // e.g. "pending" | "approved" | "rejected"

  @CreateDateColumn()
  createdAt: Date;
}
