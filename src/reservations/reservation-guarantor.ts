import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Reservation } from './reservation.entity';

@Entity({ name: 'reservation_guarantors' })
export class ReservationGuarantor {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Reservation, (r) => r.guarantors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation;

  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Column({ length: 15 })
  dni: string;

  @Column({ length: 150 })
  address: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ nullable: true })
  dniCopyPath: string | null;     // archivo adjunto

  @Column({ nullable: true })
  paystubPath: string | null;     // archivo adjunto

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
