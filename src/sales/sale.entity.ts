import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { Installment } from '../installments/installment.entity';
import { User } from '../users/user.entity';

export type PaymentComposition = {
  hasAdvance: boolean;
  hasPrendario: boolean;
  hasPersonal: boolean;
  hasFinancing: boolean;
};

@Entity({ name: 'sales' })
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  // 🧍 Cliente (datos denormalizados para reportes/listados)
  @Column({ type: 'varchar', length: 32, nullable: true })
  clientDni: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  clientName: string | null;

  @ManyToOne(() => Client, (client) => client.sales, {
    onDelete: 'SET NULL',
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'clientId' })
  client: Client | null;

  // 🚗 Vehículo
  @Column()
  vehicleId: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.sales, { eager: true })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  // 💰 Precios
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  basePrice: number;

  @Column({ default: false })
  hasTradeIn: boolean;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tradeInValue: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tradeInPlate?: string | null;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  downPayment: number; // Anticipo

  // 🏦 Prendario
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  prendarioAmount: number;

  @Column('int', { default: 0 })
  prendarioInstallments: number;

  @Column('decimal', { precision: 6, scale: 4, default: 0 })
  prendarioMonthlyRate: number; // e.g. 0.025 = 2.5%

  // 💳 Personal
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  personalAmount: number;

  @Column('int', { default: 0 })
  personalInstallments: number;

  @Column('decimal', { precision: 6, scale: 4, default: 0 })
  personalMonthlyRate: number;

  // 🏠 Financiación interna (de la casa)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  inHouseAmount: number;

  @Column('int', { default: 0 })
  inHouseInstallments: number;

  @Column('decimal', { precision: 6, scale: 4, default: 0 })
  inHouseMonthlyRate: number;

  // 💵 Totales
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  finalPrice: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balance: number;

  // 📅 Campos nuevos solicitados
  @Column('int', { default: 5 })
  paymentDay: number; // 5, 10, 15, 30

  @Column({ length: 7 })
  initialPaymentMonth: string; // "2025-12"

  // 🧑‍💼 Vendedor (usuario que registra la venta)
  @ManyToOne(() => User, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sellerId' })
  seller: User | null;

  @Column({ type: 'int', nullable: true })
  sellerId: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  sellerName: string | null;

  // ⚙️ Composición del pago (flags)
  @Column('simple-json', { nullable: true })
  paymentComposition: PaymentComposition | null;

  // 📆 Relación con cuotas (opcional)
  @OneToMany(() => Installment, (installment) => installment.sale, {
    cascade: true,
  })
  installments: Installment[];

  @CreateDateColumn()
  createdAt: Date;
}
