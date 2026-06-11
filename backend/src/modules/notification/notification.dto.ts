import { IsString, IsEnum, IsOptional, IsObject, IsArray, IsBoolean, IsUUID, IsPhoneNumber } from 'class-validator';
import { NotificationType, NotificationChannel, SubscriptionTemplateType } from './notification.entity';

export class CreateNotificationDto {
  @IsEnum(['liability_determined', 'certificate_generated', 'appeal_result', 'evidence_supplement_reminder', 'system_notice'])
  type: NotificationType;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  openid?: string;

  @IsOptional()
  @IsPhoneNumber('CN')
  phone?: string;

  @IsOptional()
  @IsUUID()
  accidentId?: string;

  @IsOptional()
  @IsString()
  accidentReportNo?: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  pagePath?: string;

  @IsOptional()
  @IsArray()
  channels?: NotificationChannel[];
}

export class SubscribeTemplateDto {
  @IsEnum(['liability_determined', 'certificate_generated', 'appeal_result', 'evidence_supplement_reminder'])
  templateType: SubscriptionTemplateType;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsBoolean()
  wechatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  wechatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;
}

export class QueryNotificationDto {
  @IsOptional()
  @IsEnum(['liability_determined', 'certificate_generated', 'appeal_result', 'evidence_supplement_reminder', 'system_notice'])
  type?: NotificationType;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}

export class MarkReadDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  all?: boolean;
}

export class SendSmsDto {
  @IsPhoneNumber('CN')
  phone: string;

  @IsString()
  templateCode: string;

  @IsOptional()
  @IsObject()
  templateParam?: Record<string, string>;
}
