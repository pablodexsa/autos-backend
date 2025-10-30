import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Brand } from '../brands/brand.entity';
import { Version } from '../versions/version.entity';

@Entity({ name: 'models' })
@Unique(['name', 'brand'])
export class Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 120 })
  name: string;

  @ManyToOne(() => Brand, b => b.models, { eager: false, onDelete: 'CASCADE' })
  brand: Brand;

  @OneToMany(() => Version, v => v.model)
  versions: Version[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
