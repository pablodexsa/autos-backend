import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Installment } from '../installments/installment.entity';

@Entity({ name: 'installment_payments' })
export class InstallmentPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Installment, (installment) => installment.payments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'installmentId' })
  installment: Installment;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ nullable: true })
  receiptPath?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
