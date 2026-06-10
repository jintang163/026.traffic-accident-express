import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AccidentEntity } from '../accident/accident.entity';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  action: string;

  @Column({ type: 'uuid', nullable: true })
  accidentId: string;

  @ManyToOne(() => AccidentEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accidentId' })
  accident: AccidentEntity;

  @Column({ type: 'uuid', nullable: true })
  targetId: string;

  @Column({ length: 50, nullable: true })
  targetType: string;

  @Column({ length: 100, nullable: true })
  operatorId: string;

  @Column({ length: 100, nullable: true })
  operatorName: string;

  @Column({ length: 50, nullable: true })
  operatorRole: string;

  @Column({ type: 'json', nullable: true })
  beforeValue: any;

  @Column({ type: 'json', nullable: true })
  afterValue: any;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 45, nullable: true })
  ipAddress: string;

  @Column({ length: 500, nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
