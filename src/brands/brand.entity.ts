import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Model } from '../models/model.entity';

@Entity({ name: 'brands' })
@Unique(['name'])
export class Brand {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 100 })
  name: string;

  @OneToMany(() => Model, m => m.brand)
  models: Model[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
