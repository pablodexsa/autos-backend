import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TreasuryAccountType, TreasuryCompany } from './treasury.enums';

@Entity({ name: 'treasury_accounts' })
@Index('idx_treasury_accounts_company_active', ['company', 'isActive'])
export class TreasuryAccount {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 120 }) name: string;
  @Column({ type: 'enum', enum: TreasuryCompany, enumName: 'treasury_company_enum' }) company: TreasuryCompany;
  @Column({ type: 'enum', enum: TreasuryAccountType, enumName: 'treasury_account_type_enum' }) type: TreasuryAccountType;
  @Column({ type: 'varchar', length: 120, nullable: true }) bankName: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) accountNumber: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) aliasCbu: string | null;
  @Column({ type: 'varchar', length: 8, default: 'ARS' }) currency: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
