import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';
import { Installment } from '../installments/installment.entity';

export enum JudicialExecutionStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

@Entity('judicial_executions')
export class JudicialExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  clientId: number;

  @ManyToOne(() => Client, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({
    type: 'enum',
    enum: JudicialExecutionStatus,
    default: JudicialExecutionStatus.ACTIVE,
  })
  status: JudicialExecutionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lawFirmName: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  executedNetAmount: number;

  @Column({ type: 'int', default: 0 })
  affectedInstallmentsCount: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @OneToMany(() => Installment, (installment) => installment.judicialExecution)
  installments: Installment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}