import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CuotaRedGender } from './enums/cuotared-gender.enum';
import { CuotaRedLeadStatus } from './enums/cuotared-lead-status.enum';

@Entity('cuotared_leads')
export class CuotaRedLead {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  dni: string;

  @Column({
    type: 'enum',
    enum: CuotaRedGender,
  })
  gender: CuotaRedGender;

  @Index()
  @Column({
    type: 'enum',
    enum: CuotaRedLeadStatus,
    default: CuotaRedLeadStatus.PENDING,
  })
  status: CuotaRedLeadStatus;

@Column({ type: 'varchar', length: 255, nullable: true })
firstName: string | null;

@Column({ type: 'varchar', length: 255, nullable: true })
lastName: string | null;

@Column({ type: 'varchar', length: 255, nullable: true })
fullName: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxApprovedAmount: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'text', nullable: true })
  statusMessage: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalReference: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse: any;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  requestedByUserId: number | null;

  @Column({ type: 'int', nullable: true })
  clientId: number | null;

  @Column({ type: 'int', nullable: true })
  budgetId: number | null;

  @Column({ type: 'int', nullable: true })
  reservationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}