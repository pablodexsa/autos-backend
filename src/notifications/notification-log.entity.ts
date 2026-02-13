import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type NotificationKind =
  | 'INSTALLMENT_DUE_5'
  | 'INSTALLMENT_DUE_2'
  | 'INSTALLMENT_DUE_0';

export type NotificationChannel = 'email' | 'whatsapp';

@Entity({ name: 'notification_logs' })
@Index('UQ_notification_unique', ['kind', 'channel', 'installmentId'], { unique: true })
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  kind: NotificationKind;

  @Column({ type: 'varchar', length: 16 })
  channel: NotificationChannel;

  @Column({ type: 'int', nullable: true })
  installmentId: number | null;

  @Column({ type: 'int', nullable: true })
  saleId: number | null;

  @Column({ type: 'int', nullable: true })
  clientId: number | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 16, default: 'SENT' })
  status: 'SENT' | 'ERROR';

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
