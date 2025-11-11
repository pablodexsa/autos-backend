import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 200 })
  module: string;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @Column({ nullable: true })
  ip: string;

  @CreateDateColumn()
  createdAt: Date;
}
