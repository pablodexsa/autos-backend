import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum KairosLeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  IN_ANALYSIS = 'IN_ANALYSIS',
  PRE_APPROVED = 'PRE_APPROVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DISBURSED = 'DISBURSED',
}

export enum KairosLeadSource {
  META_ADS = 'META_ADS',
  WHATSAPP_ORGANIC = 'WHATSAPP_ORGANIC',
  INSTAGRAM = 'INSTAGRAM',
  REFERRED = 'REFERRED',
  WEB = 'WEB',
  MANUAL = 'MANUAL',
}

@Entity('loan_leads')
export class KairosLead {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  fullName: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  cuitCuil: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  businessAddress: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  businessType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  businessAge: string | null;

  @Column('decimal', { precision: 14, scale: 2 })
  requestedAmount: number;

  @Index()
  @Column({
    type: 'enum',
    enum: KairosLeadSource,
    default: KairosLeadSource.MANUAL,
  })
  source: KairosLeadSource;

  @Index()
  @Column({
    type: 'enum',
    enum: KairosLeadStatus,
    default: KairosLeadStatus.NEW,
  })
  status: KairosLeadStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  campaign: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  adName: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmContent: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  bcraStatus: string | null;

  @Column({ type: 'jsonb', nullable: true })
  bcraRawResult: any | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  verazStatus: string | null;

  @Column({ type: 'jsonb', nullable: true })
  verazRawResult: any | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}