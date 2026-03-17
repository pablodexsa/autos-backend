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

export type VehicleCategory = 'CAR' | 'MOTORCYCLE';

@Entity({ name: 'vehicles' })
@Index(['brand', 'model', 'versionName'])
@Index(['category'])
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  // =========================
  // Denormalized (filtros rápidos)
  // =========================
  @Column({ length: 100 })
  brand: string;

  @Column({ length: 120 })
  model: string;

  @Column({ length: 150 })
  versionName: string;

  @ManyToOne(() => Version, {
    eager: false,
    onDelete: 'RESTRICT',
    nullable: false,
  })
  version: Version;

  // =========================
  // Clasificación (Autos / Motos)
  // =========================
  @Column({ type: 'varchar', length: 20, default: 'CAR' })
  category: VehicleCategory;

  // =========================
  // Estado / Soft delete
  // =========================
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // =========================
  // Datos del vehículo
  // =========================
  @Column('int')
  year: number;

  // ✅ NUEVO: Kilometraje (después de año)
  @Column({ type: 'int', nullable: true })
  kilometraje: number | null;

  @Column({ length: 20, unique: true })
  plate: string;

  @Column({ length: 100 })
  engineNumber: string;

  @Column({ length: 100 })
  chassisNumber: string;

@Column({ type: 'boolean', default: false })
isMotoPlan: boolean;

  // ✅ NUEVO: Concesionaria (después de N° chasis)
  @Column({ type: 'varchar', length: 10, nullable: true })
  concesionaria: 'DG' | 'SyS' | null;

  // ✅ NUEVO: Procedencia (después de Concesionaria)
  @Column({ type: 'varchar', length: 20, nullable: true })
  procedencia:
    | 'Randazzo'
    | 'Radatti'
    | 'Consignados'
    | 'Propios'
    | null;

  @Column({ length: 40 })
  color: string;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: {
      to: (v?: number) => v,
      from: (v: string) => Number(v),
    },
  })
  price: number;

  @Column({ length: 40 })
  status: string; // available | reserved | sold

  @Column({ default: false })
  sold: boolean; // ✅ para filtros en budgets.service

  // =========================
  // Documentación
  // =========================
  @Column({
    name: 'documentation_path',
    type: 'text',
    nullable: true,
  })
  documentationPath: string | null;

  // =========================
  // Auditoría
  // =========================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =========================
  // Relaciones
  // =========================
  @OneToMany(() => Purchase, (purchase) => purchase.vehicle)
  purchases: Purchase[];

  @OneToMany(() => Sale, (sale) => sale.vehicle)
  sales: Sale[];
}