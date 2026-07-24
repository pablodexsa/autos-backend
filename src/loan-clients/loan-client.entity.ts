import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Loan } from '../loans/loan.entity';

@Entity({ name: 'loan_clients' })
@Index('idx_loan_clients_cuit_cuil', ['cuitCuil'], { unique: true })
@Index('idx_loan_clients_dni', ['dni'], { unique: true })
export class LoanClient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  cuitCuil: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  dni: string | null;

@Column({ type: 'varchar', length: 30, nullable: true })
phone: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  workAddress: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  aliasOrCbu: string | null;

  @Column({ type: 'text', nullable: true })
  dniPhotoPath: string | null;

  @Column({ type: 'text', nullable: true })
  businessPhotoPath: string | null;

  @Column({ type: 'text', nullable: true })
  serviceBillPath: string | null;

  @Column({ type: 'text', nullable: true })
  bankAccountPath: string | null;

  @OneToMany(() => Loan, (loan) => loan.client)
  loans: Loan[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}