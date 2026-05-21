import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Loan } from '../loans/loan.entity';
import { LoanClient } from '../loan-clients/loan-client.entity';
import { LoanInstallmentPayment } from '../loan-installment-payments/loan-installment-payment.entity';

export enum LoanInstallmentStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
}

@Entity({ name: 'loan_installments' })
@Index('idx_loan_installments_dueDate_paid_status', [
  'dueDate',
  'paid',
  'status',
])
@Index('idx_loan_installments_clientId', ['clientId'])
@Index('idx_loan_installments_loanId', ['loanId'])
export class LoanInstallment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Loan, (loan) => loan.installments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column({ type: 'int' })
  loanId: number;

  @ManyToOne(() => LoanClient, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: LoanClient;

  @Column({ type: 'int' })
  clientId: number;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  remainingAmount: number | null;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ default: false })
  paid: boolean;

  @Column({
    type: 'enum',
    enum: LoanInstallmentStatus,
    enumName: 'loan_installments_status_enum',
    default: LoanInstallmentStatus.PENDING,
  })
  status: LoanInstallmentStatus;

  @Column({ type: 'int' })
  installmentNumber: number;

  @Column({ type: 'int' })
  totalInstallments: number;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastPaymentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paymentDate: Date | null;

  @OneToMany(() => LoanInstallmentPayment, (payment) => payment.installment)
  payments: LoanInstallmentPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}