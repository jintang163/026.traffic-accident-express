import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AccidentEntity } from '../accident/accident.entity';

export type AppealStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'withdrawn';

@Entity('appeals')
export class AppealEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  appealNo: string;

  @Column({ type: 'uuid' })
  accidentId: string;

  @ManyToOne(() => AccidentEntity)
  @JoinColumn({ name: 'accidentId' })
  accident: AccidentEntity;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: ['sms', 'face'], default: 'sms' })
  verifyMethod: 'sms' | 'face';

  @Column({ type: 'boolean', default: false })
  identityVerified: boolean;

  @Column({ length: 200, nullable: true })
  verifyTransactionId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'simple-array', nullable: true })
  disputedPoints: string[];

  @Column({ length: 500, nullable: true })
  dashcamVideoUrl: string;

  @Column({ type: 'simple-array', nullable: true })
  evidencePhotoUrls: string[];

  @Column({ type: 'text', nullable: true })
  additionalDescription: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'reviewing', 'approved', 'rejected', 'withdrawn'],
    default: 'pending',
  })
  status: AppealStatus;

  @Column({ length: 200, nullable: true })
  reviewer: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  reviewComment: string;

  @Column({ type: 'json', nullable: true })
  reviewResult: {
    primaryParty?: string;
    secondaryParty?: string;
    primaryLiability?: number;
    secondaryLiability?: number;
    liabilityDescription?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
