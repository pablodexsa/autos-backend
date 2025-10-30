import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Model } from '../models/model.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity({ name: 'versions' })
@Index(['name', 'model'])
export class Version {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  name: string;

  @ManyToOne(() => Model, (model) => model.versions, { eager: false, onDelete: 'CASCADE' })
  model: Model;

  @Column({ type: 'int', nullable: true })
  yearStart?: number;

  @Column({ type: 'int', nullable: true })
  yearEnd?: number;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.version)
  vehicles: Vehicle[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
