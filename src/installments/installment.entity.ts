import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Sale } from '../sales/sale.entity';
import { InstallmentPayment } from '../installment-payments/installment-payment.entity';
import { Client } from '../clients/entities/client.entity';

export enum InstallmentStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
}

export enum InstallmentReceiver {
  AGENCY = 'AGENCY',
  STUDIO = 'STUDIO',
}

@Entity({ name: 'installments' })
@Index('idx_installments_dueDate_paid_status', ['dueDate', 'paid', 'status'])
@Index('idx_installments_clientId', ['clientId'])
@Index('idx_installments_saleId', ['saleId'])
export class Installment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, (sale) => sale.installments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column({ type: 'int', nullable: false })
  saleId: number;

  @ManyToOne(() => Client, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'int', nullable: false })
  clientId: number;

  /**
   * Monto original de la cuota
   */
  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  /**
   * Saldo pendiente de capital (sin intereses de mora).
   * Se inicializa con el mismo valor que "amount" al crear la cuota.
   * En cada pago (total o parcial) se va restando.
   */
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  remainingAmount: number | null;

  /**
   * Vencimiento (solo fecha). Evita problemas de timezone.
   */
  @Column({ type: 'date' })
  dueDate: Date;

  /**
   * Indica si la cuota está completamente paga o no.
   * Para pagos parciales se mantiene en false.
   */
  @Column({ default: false })
  paid: boolean;

  /**
   * Estado de la cuota:
   * - PENDING
   * - PARTIALLY_PAID
   * - PAID
   */
  @Column({
    type: 'enum',
    enum: InstallmentStatus,
    enumName: 'installments_status_enum', // ✅ coincide con el tipo real en PG
    default: InstallmentStatus.PENDING,
  })
  status: InstallmentStatus;

  /**
   * Número de cuota dentro del plan (ej: 1, 2, 3, ...)
   */
  @Column({ type: 'int', nullable: true })
  installmentNumber: number | null;

  /**
   * Cantidad total de cuotas del plan (ej: 12, 24, ...)
   * Para poder mostrar "1/12", "9/24", etc.
   */
  @Column({ type: 'int', nullable: true })
  totalInstallments: number | null;

  /**
   * Concepto de la cuota (ej: PERSONAL_FINANCING, PRENDARIO, etc.)
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  concept: string | null;

  /**
   * Quién recibe el pago de esta cuota.
   * Lo usamos en el registro de pago y en el comprobante.
   */
  @Column({
    type: 'enum',
    enum: InstallmentReceiver,
    enumName: 'installments_receiver_enum', // ✅ coincide con el tipo real en PG
    nullable: true,
  })
  receiver: InstallmentReceiver | null;

  /**
   * Observaciones acumuladas por los distintos pagos
   * (no se pisan, se agregan al final).
   */
  @Column({ type: 'text', nullable: true })
  observations: string | null;

  /**
   * Fecha/hora del último pago realizado (total o parcial)
   * sobre esta cuota.
   */
  @Column({ type: 'timestamp', nullable: true })
  lastPaymentAt: Date | null;

  /**
   * Fecha de pago cuando la cuota quedó totalmente saldada.
   * Útil para mostrar en el comprobante final de cuota paga.
   */
  @Column({ type: 'timestamp', nullable: true })
  paymentDate: Date | null;

  @OneToMany(() => InstallmentPayment, (payment) => payment.installment)
  payments: InstallmentPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
