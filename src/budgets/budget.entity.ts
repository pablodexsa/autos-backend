import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';

@Entity()
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, { eager: true })
  vehicle: Vehicle;

  @ManyToOne(() => Client, { eager: true })
  client: Client;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  finalPrice: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  installmentValue: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  downPayment: number;

  @Column({ nullable: true })
  installments: number;

  @Column({ nullable: true })
  paymentType: string;

  @Column({ default: 'pending' })
  status: string;

  // 🔹 NUEVOS CAMPOS (agregados)
  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  tradeInValue: number; // valor de permuta

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  prendarioRate: number;

  @Column({ type: 'int', nullable: true })
  prendarioMonths: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  prendarioAmount: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  personalRate: number;

  @Column({ type: 'int', nullable: true })
  personalMonths: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  personalAmount: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  financiacionRate: number;

  @Column({ type: 'int', nullable: true })
  financiacionMonths: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  financiacionAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
