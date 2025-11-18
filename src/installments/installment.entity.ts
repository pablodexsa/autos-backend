import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Sale } from '../sales/sale.entity';
import { InstallmentPayment } from '../installment-payments/installment-payment.entity';
import { Client } from '../clients/entities/client.entity';

@Entity({ name: 'installments' })
export class Installment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, (sale) => sale.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column({ nullable: true })
  saleId: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'clientId' })
  client?: Client | null;

  @Column({ nullable: true })
  clientId?: number | null;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp' })
  dueDate: Date;

  @Column({ default: false })
  paid: boolean;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ nullable: true })
  concept: string;

  @OneToMany(() => InstallmentPayment, (payment) => payment.installment)
  payments: InstallmentPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
