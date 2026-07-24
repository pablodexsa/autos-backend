import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum CashBoxType {
  MANAGEMENT = 'MANAGEMENT',
  LOGISTICS = 'LOGISTICS',
  KAIROS = 'KAIROS',
  GL_MOTORS = 'GL_MOTORS',
}

export enum CashBoxMovementType {
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT',
  PRINCIPAL_RECOVERY = 'PRINCIPAL_RECOVERY',
  INTEREST_ALLOCATION = 'INTEREST_ALLOCATION',
  LATE_FEE_ALLOCATION = 'LATE_FEE_ALLOCATION',
  GRANT_EXPENSE = 'GRANT_EXPENSE',
  MANAGEMENT_COMMISSION = 'MANAGEMENT_COMMISSION',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

@Entity({ name: 'cash_box_movements' })
@Index('idx_cash_box_movements_box_created_at', ['boxType', 'createdAt'])
@Index('idx_cash_box_movements_loan_id', ['loanId'])
@Index('idx_cash_box_movements_payment_id', ['paymentId'])
export class CashBoxMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: CashBoxType,
    enumName: 'cash_box_type_enum',
  })
  boxType: CashBoxType;

  @Column({
    type: 'enum',
    enum: CashBoxMovementType,
    enumName: 'cash_box_movement_type_enum',
  })
  movementType: CashBoxMovementType;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  principalAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  interestAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  expenseAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  lateFeeAmount: number;

  @Column({ type: 'int', nullable: true })
  loanId: number | null;

  @Column({ type: 'int', nullable: true })
  installmentId: number | null;

  @Column({ type: 'int', nullable: true })
  paymentId: number | null;

  @Column({ type: 'int', nullable: true })
  saleId: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
