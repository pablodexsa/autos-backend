import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';
import { User } from '../users/user.entity';

export enum RefundStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
}

@Entity({ name: 'refunds' })
export class Refund {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'int' })
  reservationId: number;

  @ManyToOne(() => Reservation, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation;

  @Column({ type: 'varchar', length: 32 })
  clientDni: string;

  @Column({ type: 'varchar', length: 16 })
  plate: string;

  @Column({ type: 'varchar', length: 180 })
  vehicleLabel: string;

  // Fecha cancelación (tu campo "Fecha")
  @Column({ type: 'timestamptz' })
  canceledAt: Date;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.PENDING })
  status: RefundStatus;

  // Monto esperado (snapshot al cancelar)
  @Column({ type: 'int' })
  expectedAmount: number;

  // Se completa cuando se entrega
  @Column({ type: 'int', nullable: true })
  paidAmount: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'int', nullable: true })
  deliveredByUserId: number | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'deliveredByUserId' })
  deliveredByUser: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
