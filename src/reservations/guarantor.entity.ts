import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Reservation } from './reservation.entity';

@Entity('guarantors')
export class Guarantor {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Reservation, (reservation) => reservation.guarantors, {
    onDelete: 'CASCADE',
  })
  reservation: Reservation;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ length: 15 })
  dni: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

@Column({ type: 'varchar', length: 255, nullable: true })
dniFilePath: string | null;

@Column({ type: 'varchar', length: 255, nullable: true })
payslipFilePath: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
