import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity({ name: 'settings' })
@Unique(['key'])
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  key: string;

  @Column({ type: 'text' })
  value: string;
}
