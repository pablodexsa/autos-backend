import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity()
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.sales, { onDelete: 'CASCADE' })
  vehicle: Vehicle;

  @Column()
  saleDate: string;

  @Column('decimal')
  price: number;

  @Column({ nullable: true })
  documentPath?: string | null; // ✅ permite null
}
