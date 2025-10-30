import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'installment_setting' })
export class InstallmentSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  installments: number; // cantidad de cuotas

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number; // porcentaje de aumento

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
