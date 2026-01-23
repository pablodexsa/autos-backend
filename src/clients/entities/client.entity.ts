import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sale } from '../../sales/sale.entity';

@Entity({ name: 'client' })
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  firstName: string;

  @Column({ length: 50 })
  lastName: string;

  @Column({ length: 20, unique: true })
  dni: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 200, nullable: true })
  address: string;

  // 📄 Ruta relativa del DNI adjunto (PDF/imagen/etc) dentro de /uploads
  @Column({ name: 'dni_path', type: 'text', nullable: true })
  dniPath: string | null;

  @OneToMany(() => Sale, (sale) => sale.client)
  sales: Sale[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
