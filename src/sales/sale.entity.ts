import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle)
  @JoinColumn()
  vehicle: Vehicle;

  @Column()
  precioVenta: number;

  @Column({ type: 'date' })
  fechaVenta: Date;

  @Column()
  cliente: string;
}
