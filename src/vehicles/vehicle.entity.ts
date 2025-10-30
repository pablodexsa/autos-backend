import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Version } from '../versions/version.entity';
import { Purchase } from '../purchases/purchase.entity';
import { Sale } from '../sales/sale.entity';

@Entity({ name: 'vehicles' })
@Index(['brand', 'model', 'versionName'])
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  // Denormalized for quick filters
  @Column({ length: 100 })
  brand: string;

  @Column({ length: 120 })
  model: string;

  @Column({ length: 150 })
  versionName: string;

  @ManyToOne(() => Version, { eager: false, onDelete: 'RESTRICT', nullable: false })
  version: Version;

  @Column('int')
  year: number;

  @Column({ length: 20, unique: true })
  plate: string;

  @Column({ length: 100 })
  engineNumber: string;

  @Column({ length: 100 })
  chassisNumber: string;

  @Column({ length: 40 })
  color: string;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: { to: (v?: number) => v, from: (v: string) => Number(v) },
  })
  price: number;

  @Column({ length: 40 })
  status: string; // available | reserved | sold

  @Column({ default: false })
  sold: boolean; // ✅ para filtros en budgets.service

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ✅ Relaciones agregadas para resolver errores
  @OneToMany(() => Purchase, (purchase) => purchase.vehicle)
  purchases: Purchase[];

  @OneToMany(() => Sale, (sale) => sale.vehicle)
  sales: Sale[];
}
