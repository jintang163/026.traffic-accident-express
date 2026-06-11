import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type SubscriptionTemplateType =
  | 'liability_determined'
  | 'certificate_generated'
  | 'appeal_result'
  | 'evidence_supplement_reminder';

@Entity('notification_subscriptions')
export class NotificationSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ length: 100, nullable: true })
  @Index()
  openid: string;

  @Column({ length: 50 })
  @Index()
  templateType: SubscriptionTemplateType;

  @Column({ length: 100 })
  templateId: string;

  @Column({ default: true })
  wechatEnabled: boolean;

  @Column({ default: true })
  smsEnabled: boolean;

  @Column({ default: true })
  inAppEnabled: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastSubscribedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastUnsubscribedAt: Date;

  @Column({ type: 'int', default: 0 })
  subscribeCount: number;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
