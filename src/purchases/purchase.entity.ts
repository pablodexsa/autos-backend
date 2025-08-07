import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity()
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.purchases, { onDelete: 'CASCADE' })
  vehicle: Vehicle;

  @Column()
  purchaseDate: string;

  @Column('decimal')
  price: number;

  @Column({ nullable: true })
  documentPath?: string | null; // ? permite null
}
