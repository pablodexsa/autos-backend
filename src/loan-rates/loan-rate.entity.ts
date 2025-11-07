import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type LoanType = 'prendario' | 'personal' | 'financiacion';

@Entity('loan_rates')
export class LoanRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  type: LoanType; // ✅ usa el tipo personalizado, no string

  @Column()
  months: number;

  @Column('decimal', { precision: 6, scale: 2 })
  rate: number;
}
