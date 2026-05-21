import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { LoanInstallment } from '../loan-installments/loan-installment.entity';
import { LoanClient } from '../loan-clients/loan-client.entity';
import { Loan } from '../loans/loan.entity';

@Entity({ name: 'loan_installment_payments' })
@Index('idx_loan_installment_payments_installmentId', ['installmentId'])
@Index('idx_loan_installment_payments_clientId', ['clientId'])
export class LoanInstallmentPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => LoanInstallment, (installment) => installment.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'installmentId' })
  installment: LoanInstallment;

  @Column({ type: 'int' })
  installmentId: number;

  @ManyToOne(() => Loan, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column({ type: 'int' })
  loanId: number;

  @ManyToOne(() => LoanClient, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clientId' })
  client: LoanClient | null;

  @Column({ type: 'int', nullable: true })
  clientId: number | null;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ type: 'text', nullable: true })
  receiptPath: string | null;

  @Column({ default: true })
  isPaid: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}