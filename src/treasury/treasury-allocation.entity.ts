import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TreasuryAccount } from './treasury-account.entity';
import { TreasuryMovement } from './treasury-movement.entity';
import { TreasuryPaymentMethod } from './treasury.enums';

@Entity({ name: 'treasury_allocations' })
@Index('idx_treasury_allocations_account', ['accountId'])
export class TreasuryAllocation {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => TreasuryMovement, (m) => m.allocations, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'movementId' }) movement: TreasuryMovement;
  @Column({ type: 'int' }) movementId: number;
  @ManyToOne(() => TreasuryAccount, { eager: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'accountId' }) account: TreasuryAccount;
  @Column({ type: 'int' }) accountId: number;
  // Signed ledger amount: positive adds money to the account, negative removes it.
  @Column('decimal', { precision: 15, scale: 2 }) amount: number;
  @Column({ type: 'enum', enum: TreasuryPaymentMethod, enumName: 'treasury_payment_method_enum', default: TreasuryPaymentMethod.OTHER }) paymentMethod: TreasuryPaymentMethod;
  @Column({ type: 'varchar', length: 120, nullable: true }) reference: string | null;
}
