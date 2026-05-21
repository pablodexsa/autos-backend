import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LoanFundMovementType {
  INITIAL = 'INITIAL',
  LOAN_GRANTED = 'LOAN_GRANTED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

@Entity({ name: 'loan_fund_movements' })
@Index('idx_loan_fund_movements_type', ['type'])
export class LoanFundMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: LoanFundMovementType,
    enumName: 'loan_fund_movement_type_enum',
  })
  type: LoanFundMovementType;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'int', nullable: true })
  loanId: number | null;

  @Column({ type: 'int', nullable: true })
  paymentId: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}