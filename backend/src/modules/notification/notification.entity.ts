import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type NotificationType =
  | 'liability_determined'
  | 'certificate_generated'
  | 'appeal_result'
  | 'evidence_supplement_reminder'
  | 'system_notice';

export type NotificationChannel = 'wechat_subscribe' | 'sms' | 'in_app';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  @Index()
  type: NotificationType;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @Column({ length: 100, nullable: true })
  @Index()
  openid: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  accidentId: string;

  @Column({ length: 50, nullable: true })
  accidentReportNo: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', nullable: true })
  data: Record<string, any>;

  @Column({ length: 200, nullable: true })
  pagePath: string;

  @Column({
    type: 'simple-array',
    default: 'in_app',
  })
  channels: NotificationChannel[];

  @Column({
    type: 'enum',
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
  })
  @Index()
  status: NotificationStatus;

  @Column({ type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'json', nullable: true })
  wechatResult: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  smsResult: Record<string, any>;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
