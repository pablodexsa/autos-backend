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
import { LoanClient } from '../loan-clients/loan-client.entity';
import { LoanInstallment } from '../loan-installments/loan-installment.entity';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'loans' })
@Index('idx_loans_clientId', ['clientId'])
@Index('idx_loans_requestDate', ['requestDate'])
export class Loan {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => LoanClient, (client) => client.loans, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'clientId' })
  client: LoanClient;

  @Column({ type: 'int' })
  clientId: number;

  @Column({ type: 'varchar', length: 20 })
  clientCuitCuil: string;

  @Column({ type: 'varchar', length: 180 })
  clientName: string;

  @Column('decimal', { precision: 15, scale: 2 })
  requestedAmount: number;

  @Column('decimal', { precision: 15, scale: 2 })
  interestAmount: number;

  @Column('decimal', { precision: 15, scale: 2 })
  totalToReturn: number;

  @Column('decimal', { precision: 15, scale: 2 })
  installmentAmount: number;

  @Column({ type: 'date' })
  requestDate: string;

  @Column({ type: 'int' })
  weeklyInstallments: number;

  @Column('decimal', { precision: 6, scale: 2, default: 60 })
  monthlyInterestRate: number;

  @Column('decimal', { precision: 6, scale: 2, default: 5 })
  dailyLateInterestRate: number;

  @Column({
    type: 'enum',
    enum: LoanStatus,
    enumName: 'loans_status_enum',
    default: LoanStatus.ACTIVE,
  })
  status: LoanStatus;

  @OneToMany(() => LoanInstallment, (installment) => installment.loan, {
    cascade: true,
  })
  installments: LoanInstallment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}