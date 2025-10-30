import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'installment_settings' })
export class InstallmentSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  months: number;

  @Column('decimal', { precision: 5, scale: 2 })
  increasePercentage: number;
}
