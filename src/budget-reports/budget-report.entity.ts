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
import { User } from '../users/user.entity';

@Entity({ name: 'budget_reports' })
export class BudgetReport {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔗 ID del presupuesto original (budgets.id)
  @Column({ type: 'int', nullable: true })
  budgetId?: number;

  @ManyToOne(() => Vehicle, { eager: true })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @ManyToOne(() => Client, { eager: true })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'sellerId' })
  seller?: User;

  @Column({ type: 'varchar', length: 50 })
  paymentType: string;

  @Column({ type: 'int', nullable: true })
  installments?: number;

  // ⬆️ Subí precisión para evitar “numeric field overflow”
  @Column({ type: 'decimal', precision: 18, scale: 2 })
  listPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  finalPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  installmentValue?: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  downPayment?: number;

  @CreateDateColumn()
  createdAt: Date;
}
