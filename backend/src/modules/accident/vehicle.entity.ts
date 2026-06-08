import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AccidentEntity } from './accident.entity';

@Entity('vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AccidentEntity, (accident) => accident.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accidentId' })
  accident: AccidentEntity;

  @Column({ type: 'uuid' })
  accidentId: string;

  @Column({ length: 20 })
  plateNo: string;

  @Column({ length: 20, default: 'blue' })
  plateColor: string;

  @Column({ length: 50, default: '小型汽车' })
  vehicleType: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  confidence: number;

  @Column({ length: 200, nullable: true })
  platePhotoUrl: string;

  @Column({ length: 50, nullable: true })
  ownerName: string;

  @Column({ length: 20, nullable: true })
  ownerPhone: string;

  @Column({ length: 100, nullable: true })
  insuranceCompany: string;

  @Column({ type: 'int', default: 1 })
  vehicleOrder: number;
}
