import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sale } from '../sales/sale.entity';
import { InstallmentPayment } from '../installment-payments/installment-payment.entity';
import { Client } from '../clients/entities/client.entity';

@Entity({ name: 'installments' })
export class Installment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, (sale) => sale.id, { onDelete: 'CASCADE' })
  sale: Sale;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: true })
  client: Client;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ default: false })
  paid: boolean;

  @OneToMany(() => InstallmentPayment, (payment) => payment.installment)
  payments: InstallmentPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
