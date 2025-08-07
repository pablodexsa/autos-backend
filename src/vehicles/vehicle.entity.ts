import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Purchase } from '../purchases/purchase.entity';
import { Sale } from '../sales/sale.entity';

@Entity()
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column()
  year: number;

  @OneToMany(() => Purchase, (purchase) => purchase.vehicle)
  purchases: Purchase[];

  @OneToMany(() => Sale, (sale) => sale.vehicle)
  sales: Sale[];
}
