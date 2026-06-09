import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('liability_rules')
export class LiabilityRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  ruleType: 'hard' | 'soft';

  @Column({ type: 'int', default: 50 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ length: 50 })
  accidentType: string;

  @Column({ type: 'text', nullable: true })
  conditionExpression: string;

  @Column({ length: 10, default: 'none' })
  primaryParty: string;

  @Column({ type: 'int', default: 50 })
  primaryLiability: number;

  @Column({ type: 'int', default: 50 })
  secondaryLiability: number;

  @Column({ type: 'text', nullable: true })
  liabilityDescription: string;

  @Column({ type: 'text', nullable: true })
  legalBasis: string;

  @Column({ type: 'boolean', default: false })
  needsManualReview: boolean;

  @Column({ type: 'text', nullable: true })
  reviewReason: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  confidence: number;

  @Column({ length: 100, nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
