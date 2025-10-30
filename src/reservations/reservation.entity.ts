import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { User } from '../users/user.entity';
import { Guarantor } from './guarantor.entity';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔹 Cliente asociado
  @ManyToOne(() => Client, { eager: true, onDelete: 'CASCADE' })
  client: Client;

  // 🔹 Vehículo reservado
  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'CASCADE' })
  vehicle: Vehicle;

  // 🔹 Usuario que generó la reserva (vendedor)
  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  seller: User;

  // 🔹 Patente (copiada del vehículo al momento de reservar)
  @Column({ type: 'varchar', length: 20 })
  plate: string;

  // 🔹 Descripción legible del vehículo
  @Column({ type: 'varchar', length: 150 })
  vehicleLabel: string;

  // 🔹 Importe de la reserva (por defecto $500.000)
  @Column('decimal', { precision: 12, scale: 2, default: 500000 })
  amount: number;

  // 🔹 Fecha de creación
  @CreateDateColumn()
  date: Date;

  // 🔹 Fecha de vencimiento de la reserva (48hs por defecto)
  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date;

  // 🔹 Estado: Vigente / Vencida / Cancelada / Aceptada
  @Column({ type: 'varchar', length: 20, default: 'Vigente' })
  status: string;

  // 🔹 Relación con garantes
  @OneToMany(() => Guarantor, (guarantor) => guarantor.reservation, {
    cascade: true,
  })
  guarantors: Guarantor[];

@UpdateDateColumn({ type: 'timestamp', nullable: true })
updatedAt: Date;

}
