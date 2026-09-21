import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TreasuryAllocation } from './treasury-allocation.entity';
import { TreasuryCompany, TreasuryMovementStatus, TreasuryMovementType } from './treasury.enums';

@Entity({ name: 'treasury_movements' })
@Index('idx_treasury_movements_date', ['movementDate'])
@Index('idx_treasury_movements_company_type', ['company', 'type'])
@Index('idx_treasury_movements_source', ['sourceType', 'sourceId'])
export class TreasuryMovement {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: TreasuryCompany, enumName: 'treasury_company_enum', nullable: true }) company: TreasuryCompany | null;
  @Column({ type: 'enum', enum: TreasuryMovementType, enumName: 'treasury_movement_type_enum' }) type: TreasuryMovementType;
  @Column({ type: 'enum', enum: TreasuryMovementStatus, enumName: 'treasury_movement_status_enum', default: TreasuryMovementStatus.POSTED }) status: TreasuryMovementStatus;
  @Column({ type: 'date' }) movementDate: string;
  @Column('decimal', { precision: 15, scale: 2 }) totalAmount: number;
  @Column({ type: 'int', nullable: true }) categoryId: number | null;
  @Column({ type: 'varchar', length: 180, nullable: true }) counterparty: string | null;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) reference: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) sourceType: string | null;
  @Column({ type: 'int', nullable: true }) sourceId: number | null;
  @Column({ type: 'int', nullable: true }) loanId: number | null;
  @Column({ type: 'int', nullable: true }) installmentId: number | null;
  @Column({ type: 'int', nullable: true }) paymentId: number | null;
  @Column({ type: 'int', nullable: true }) saleId: number | null;
  @Column({ type: 'int', nullable: true }) clientId: number | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) attachmentPath: string | null;
  @Column({ type: 'int' }) createdBy: number;
  @Column({ type: 'int', nullable: true }) voidedBy: number | null;
  @Column({ type: 'timestamp', nullable: true }) voidedAt: Date | null;
  @Column({ type: 'text', nullable: true }) voidReason: string | null;
  @OneToMany(() => TreasuryAllocation, (a) => a.movement, { cascade: true, eager: true }) allocations: TreasuryAllocation[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
