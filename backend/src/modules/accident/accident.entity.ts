import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { VehicleEntity } from './vehicle.entity';
import { PhotoEntity } from './photo.entity';

export type AccidentStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'manual_review';
export type AccidentType = 'rear_end' | 'side_swipe' | 'head_on' | 'reverse' | 'intersection' | 'other';
export type ReviewStatus = 'none' | 'pending' | 'approved' | 'rejected';

@Entity('accidents')
export class AccidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  reportNo: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'rejected', 'manual_review'],
    default: 'pending',
  })
  status: AccidentStatus;

  @Column({ type: 'datetime' })
  occurTime: Date;

  @Column({ length: 500 })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  longitude: number;

  @OneToMany(() => VehicleEntity, (vehicle) => vehicle.accident, { cascade: true })
  vehicles: VehicleEntity[];

  @OneToMany(() => PhotoEntity, (photo) => photo.accident, { cascade: true })
  scenePhotos: PhotoEntity[];

  @Column({
    type: 'enum',
    enum: ['rear_end', 'side_swipe', 'head_on', 'reverse', 'intersection', 'other'],
    default: 'other',
  })
  accidentType: AccidentType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 20, default: '晴' })
  weather: string;

  @Column({ length: 20, default: '干燥' })
  roadCondition: string;

  @Column({ type: 'json', nullable: true })
  collisionPositions: {
    vehicleA: string[];
    vehicleB: string[];
  };

  @Column({ type: 'boolean', default: false })
  laneCrossingA: boolean;

  @Column({ type: 'boolean', default: false })
  laneCrossingB: boolean;

  @Column({ type: 'boolean', default: false })
  hasDashcamVideo: boolean;

  @Column({ type: 'text', nullable: true })
  dashcamVideoUrl: string;

  @Column({ type: 'boolean', default: false })
  integrityConfirmed: boolean;

  @Column({ type: 'json', nullable: true })
  liabilityResult: {
    primaryParty: string;
    secondaryParty: string;
    primaryLiability: number;
    secondaryLiability: number;
    liabilityType: string;
    liabilityDescription: string;
    ruleId: string;
    ruleName: string;
    ruleType: string;
    legalBasis: string;
    confidence: number;
    needsManualReview: boolean;
    reviewReason?: string;
    determinedAt: Date;
    officer: string;
  };

  @Column({
    type: 'enum',
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  })
  reviewStatus: ReviewStatus;

  @Column({ type: 'json', nullable: true })
  reviewResult: {
    reviewer: string;
    reviewedAt: Date;
    primaryParty: string;
    primaryLiability: number;
    secondaryLiability: number;
    liabilityDescription: string;
    reviewComment: string;
  };

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
