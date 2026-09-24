import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TreasuryCompany } from './treasury.enums';

export enum TreasuryPendingPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TreasuryPendingStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'treasury_pending' })
@Index(['company', 'status', 'dueDate'])
@Index(['priority', 'status'])
export class TreasuryPending {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, default: TreasuryCompany.KAIROS })
  company: TreasuryCompany;

  @Column({ type: 'varchar', length: 180 })
  description: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  counterparty: string | null;

  @Column('decimal', {
    precision: 14,
    scale: 2,
    transformer: {
      to: (v?: number) => v,
      from: (v: string) => Number(v),
    },
  })
  amount: number;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 20, default: TreasuryPendingPriority.MEDIUM })
  priority: TreasuryPendingPriority;

  @Column({ type: 'varchar', length: 20, default: TreasuryPendingStatus.PENDING })
  status: TreasuryPendingStatus;

  @Column({ type: 'int', nullable: true })
  categoryId: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', nullable: true })
  treasuryMovementId: number | null;

  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
