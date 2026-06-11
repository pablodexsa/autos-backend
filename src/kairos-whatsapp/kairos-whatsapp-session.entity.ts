import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum KairosWhatsappStep {
  FULL_NAME = 'FULL_NAME',
  CUIT_CUIL = 'CUIT_CUIL',
  PHONE = 'PHONE',
  BUSINESS_ADDRESS = 'BUSINESS_ADDRESS',
  BUSINESS_TYPE = 'BUSINESS_TYPE',
  BUSINESS_AGE = 'BUSINESS_AGE',
  REQUESTED_AMOUNT = 'REQUESTED_AMOUNT',
  CONFIRMATION = 'CONFIRMATION',
  COMPLETED = 'COMPLETED',
}

@Entity('kairos_whatsapp_sessions')
export class KairosWhatsappSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  whatsappPhone: string;

  @Column({
    type: 'enum',
    enum: KairosWhatsappStep,
    default: KairosWhatsappStep.FULL_NAME,
  })
  currentStep: KairosWhatsappStep;

  @Column({ type: 'jsonb', nullable: true })
  data: any | null;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'int', nullable: true })
  leadId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}