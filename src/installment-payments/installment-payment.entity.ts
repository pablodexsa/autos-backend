import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Installment } from '../installments/installment.entity';
import { Client } from '../clients/entities/client.entity';

@Entity({ name: 'installment_payments' })
export class InstallmentPayment {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔗 Relación con la cuota
  @ManyToOne(() => Installment, (installment) => installment.payments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'installmentId' })
  installment: Installment;

  @Column({ nullable: false })
  installmentId: number;

  // 🔗 Relación con el cliente (para mostrar en el frontend sin joins anidados)
  @ManyToOne(() => Client, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'clientId' })
  client?: Client;

  @Column({ nullable: true })
  clientId?: number;

  // 💰 Monto del pago
  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  // 📅 Fecha del pago
  @Column({ type: 'date' })
  paymentDate: string;

  // 🧾 Ruta del comprobante PDF o imagen subida
  @Column({ nullable: true })
  receiptPath?: string;

  // ⚙️ Estado del pago (útil para control de cobranzas)
  @Column({ default: true })
  isPaid: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
