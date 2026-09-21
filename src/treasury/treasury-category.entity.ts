import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TreasuryCompany, TreasuryMovementType } from './treasury.enums';

@Entity({ name: 'treasury_categories' })
@Index('idx_treasury_categories_type_active', ['movementType', 'isActive'])
export class TreasuryCategory {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 100 }) name: string;
  @Column({ type: 'enum', enum: TreasuryMovementType, enumName: 'treasury_movement_type_enum' }) movementType: TreasuryMovementType;
  @Column({ type: 'enum', enum: TreasuryCompany, enumName: 'treasury_company_enum', nullable: true }) company: TreasuryCompany | null;
  @Column({ type: 'int', nullable: true }) parentId: number | null;
  @Column({ default: true }) isActive: boolean;
  @Column({ type: 'int', default: 0 }) sortOrder: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
