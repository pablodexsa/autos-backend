import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { Installment } from '../installments/installment.entity';
import { User } from '../users/user.entity'; // 👈 vendedor

@Entity({ name: 'sales' })
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔹 Cliente asociado a la venta
  @ManyToOne(() => Client, (client) => client.sales, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  // 🔹 Vehículo vendido
  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  // 🔹 Vendedor (usuario del sistema)
  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  // 🔹 Tipo de venta: contado / cuotas / anticipo + cuotas
  @Column({ length: 30 })
  saleType: string;

  // 🔹 Precio final de la venta
  @Column('decimal', { precision: 12, scale: 2 })
  finalPrice: number;

  // 🔹 Monto de anticipo (si aplica)
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  downPayment: number;

  // 🔹 Cantidad de cuotas
  @Column({ type: 'int', nullable: true })
  installments: number;

  // 🔹 Valor de cada cuota (ya con incremento aplicado)
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  installmentValue: number;

  // 🔹 Estado general de la venta
  @Column({ length: 20, default: 'active' }) // active | paid | canceled
  status: string;

  // 🔹 Fecha de la venta (registrada manualmente)
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  saleDate: Date;

  // 🔹 Relación con cuotas generadas
  @OneToMany(() => Installment, (installment) => installment.sale, { cascade: true })
  installmentsList: Installment[];

  // 🔹 Fecha de creación / actualización
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
