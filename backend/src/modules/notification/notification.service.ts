import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  NotificationEntity,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from './notification.entity';
import {
  NotificationSubscriptionEntity,
  SubscriptionTemplateType,
} from './notification-subscription.entity';
import { CreateNotificationDto, SubscribeTemplateDto, UpdateSubscriptionDto, QueryNotificationDto } from './notification.dto';
import { WechatSubscribeService } from './wechat-subscribe.service';
import { SmsService } from './sms.service';
import { MessageQueueService, QueueName } from './message-queue.service';
import { CacheService } from './cache.service';

const SUBSCRIPTION_CACHE_PREFIX = 'notification:subscription:';
const SUBSCRIPTION_CACHE_TTL = 1800;

const TEMPLATE_TYPE_MAP: Record<NotificationType, SubscriptionTemplateType | null> = {
  liability_determined: 'liability_determined',
  certificate_generated: 'certificate_generated',
  appeal_result: 'appeal_result',
  evidence_supplement_reminder: 'evidence_supplement_reminder',
  system_notice: null,
};

const SMS_TEMPLATE_MAP: Record<NotificationType, string> = {
  liability_determined: 'SMS_LIABILITY',
  certificate_generated: 'SMS_CERTIFICATE',
  appeal_result: 'SMS_APPEAL',
  evidence_supplement_reminder: 'SMS_EVIDENCE',
  system_notice: 'SMS_SYSTEM',
};

const PAGE_PATH_MAP: Record<NotificationType, string> = {
  liability_determined: '/pages/accident-detail/index',
  certificate_generated: '/pages/certificate-detail/index',
  appeal_result: '/pages/appeal/index',
  evidence_supplement_reminder: '/pages/accident-detail/index',
  system_notice: '/pages/home/index',
};

const NOTIFICATION_TITLE_MAP: Record<NotificationType, string> = {
  liability_determined: '定责完成通知',
  certificate_generated: '认定书生成通知',
  appeal_result: '复核结果通知',
  evidence_supplement_reminder: '证据补充提醒',
  system_notice: '系统通知',
};

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(NotificationSubscriptionEntity)
    private subscriptionRepository: Repository<NotificationSubscriptionEntity>,
    private wechatService: WechatSubscribeService,
    private smsService: SmsService,
    private mqService: MessageQueueService,
    private cacheService: CacheService,
  ) {}

  onModuleInit() {
    this.mqService.subscribe('notification_push', async (message) => {
      await this.processNotificationPush(message.payload);
    });

    this.mqService.subscribe('sms_send', async (message) => {
      await this.processSmsSend(message.payload);
    });

    this.mqService.subscribe('wechat_push', async (message) => {
      await this.processWechatPush(message.payload);
    });

    this.logger.log('Notification service initialized');
  }

  async create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    const notification = this.notificationRepository.create({
      type: dto.type,
      userId: dto.userId,
      openid: dto.openid,
      phone: dto.phone,
      accidentId: dto.accidentId,
      accidentReportNo: dto.accidentReportNo,
      title: dto.title || NOTIFICATION_TITLE_MAP[dto.type] || '通知',
      content: dto.content,
      data: dto.data || {},
      pagePath: dto.pagePath || PAGE_PATH_MAP[dto.type],
      channels: dto.channels || ['in_app'],
      status: 'pending',
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);
    this.logger.log(`Notification created: ${saved.id} (${saved.type})`);
    return saved;
  }

  async pushNotification(dto: CreateNotificationDto): Promise<NotificationEntity> {
    const notification = await this.create(dto);

    await this.mqService.send('notification_push', 'push', {
      notificationId: notification.id,
    });

    return notification;
  }

  async pushToBothParties(
    dto: Omit<CreateNotificationDto, 'userId' | 'openid' | 'phone'> & {
      partyA: { userId?: string; openid?: string; phone?: string };
      partyB: { userId?: string; openid?: string; phone?: string };
    },
  ): Promise<NotificationEntity[]> {
    const results: NotificationEntity[] = [];

    for (const party of [dto.partyA, dto.partyB]) {
      if (!party.userId && !party.openid && !party.phone) continue;

      const notificationDto: CreateNotificationDto = {
        ...dto,
        userId: party.userId,
        openid: party.openid,
        phone: party.phone,
      } as CreateNotificationDto;

      const notification = await this.pushNotification(notificationDto);
      results.push(notification);
    }

    return results;
  }

  private async processNotificationPush(payload: { notificationId: string }) {
    const notification = await this.notificationRepository.findOne({
      where: { id: payload.notificationId },
    });

    if (!notification) {
      this.logger.warn(`Notification not found: ${payload.notificationId}`);
      return;
    }

    if (notification.status !== 'pending') {
      return;
    }

    try {
      const channels = notification.channels || ['in_app'];
      const promises: Promise<void>[] = [];

      if (channels.includes('wechat_subscribe') && notification.openid) {
        promises.push(this.sendWechatMessage(notification));
      }

      if (channels.includes('sms') && notification.phone) {
        promises.push(this.sendSmsMessage(notification));
      }

      if (channels.includes('in_app')) {
        notification.isRead = false;
      }

      await Promise.all(promises);

      notification.status = 'sent';
      notification.sentAt = new Date();
    } catch (error) {
      this.logger.error(`Notification push failed: ${notification.id} - ${error.message}`);
      notification.status = 'failed';
      notification.errorMessage = error.message;
      notification.retryCount = (notification.retryCount || 0) + 1;
    }

    await this.notificationRepository.save(notification);
  }

  private async sendWechatMessage(notification: NotificationEntity): Promise<void> {
    const templateType = TEMPLATE_TYPE_MAP[notification.type];

    if (!templateType || !notification.openid) {
      return;
    }

    const subscription = await this.getUserSubscription(
      notification.userId || '',
      templateType,
    );

    if (!subscription?.wechatEnabled || !subscription.templateId) {
      this.logger.warn(`Wechat subscription not enabled for user ${notification.userId}, template ${templateType}`);
      return;
    }

    const data = notification.data || {};
    const wechatData: Record<string, { value: string }> = {};

    for (const key of Object.keys(data)) {
      wechatData[key] = { value: String(data[key]).slice(0, 20) };
    }

    const result = await this.wechatService.sendSubscribeMessage({
      touser: notification.openid,
      template_id: subscription.templateId,
      page: notification.pagePath ? notification.pagePath + '?id=' + notification.accidentId : undefined,
      data: wechatData,
    });

    notification.wechatResult = result as any;

    if (!result.success) {
      this.logger.warn(`Wechat message failed: ${result.errmsg}`);
      if (notification.phone && notification.channels.includes('sms')) {
        await this.mqService.send('sms_send', 'sms_fallback', {
          notificationId: notification.id,
        });
      }
    } else {
      this.incrementSubscriptionSentCount(notification.userId || '', templateType);
    }
  }

  private async sendSmsMessage(notification: NotificationEntity): Promise<void> {
    if (!notification.phone) return;

    const templateCode = SMS_TEMPLATE_MAP[notification.type];
    const data = notification.data || {};

    const templateParam: Record<string, string> = {};
    for (const key of Object.keys(data)) {
      templateParam[key] = String(data[key]);
    }

    const result = await this.smsService.sendSms(
      notification.phone,
      templateCode,
      templateParam,
    );

    notification.smsResult = result as any;

    if (!result.success) {
      this.logger.warn(`SMS send failed: ${result.message}`);
      throw new Error(result.message || 'SMS send failed');
    }
  }

  private async processSmsSend(payload: { notificationId: string }) {
    const notification = await this.notificationRepository.findOne({
      where: { id: payload.notificationId },
    });

    if (!notification || !notification.phone) return;

    try {
      await this.sendSmsMessage(notification);
      if (notification.status === 'failed') {
        notification.status = 'sent';
        notification.sentAt = new Date();
      }
      notification.smsResult = { ...(notification.smsResult || {}), fallback: true };
    } catch (error) {
      this.logger.error(`SMS fallback failed: ${error.message}`);
    }

    await this.notificationRepository.save(notification);
  }

  private async processWechatPush(payload: { notificationId: string }) {
    const notification = await this.notificationRepository.findOne({
      where: { id: payload.notificationId },
    });

    if (!notification) return;
    await this.sendWechatMessage(notification);
    await this.notificationRepository.save(notification);
  }

  async getUserSubscription(
    userId: string,
    templateType: SubscriptionTemplateType,
  ): Promise<NotificationSubscriptionEntity | null> {
    const cacheKey = SUBSCRIPTION_CACHE_PREFIX + userId + ':' + templateType;
    const cached = await this.cacheService.get<NotificationSubscriptionEntity>(cacheKey);

    if (cached) {
      return cached;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, templateType },
    });

    if (subscription) {
      await this.cacheService.set(cacheKey, subscription, SUBSCRIPTION_CACHE_TTL);
    }

    return subscription;
  }

  async getUserSubscriptions(userId: string): Promise<NotificationSubscriptionEntity[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async subscribeTemplate(
    userId: string,
    dto: SubscribeTemplateDto,
  ): Promise<NotificationSubscriptionEntity> {
    let subscription = await this.subscriptionRepository.findOne({
      where: { userId, templateType: dto.templateType },
    });

    if (subscription) {
      subscription.templateId = dto.templateId;
      subscription.wechatEnabled = dto.wechatEnabled ?? subscription.wechatEnabled;
      subscription.smsEnabled = dto.smsEnabled ?? subscription.smsEnabled;
      subscription.lastSubscribedAt = new Date();
      subscription.subscribeCount += 1;
    } else {
      subscription = this.subscriptionRepository.create({
        id: uuidv4(),
        userId,
        templateType: dto.templateType,
        templateId: dto.templateId,
        wechatEnabled: dto.wechatEnabled ?? true,
        smsEnabled: dto.smsEnabled ?? true,
        inAppEnabled: true,
        lastSubscribedAt: new Date(),
        subscribeCount: 1,
        sentCount: 0,
      });
    }

    const saved = await this.subscriptionRepository.save(subscription);

    const cacheKey = SUBSCRIPTION_CACHE_PREFIX + userId + ':' + dto.templateType;
    await this.cacheService.delete(cacheKey);

    this.logger.log(`User ${userId} subscribed to template ${dto.templateType}`);
    return saved;
  }

  async updateSubscription(
    id: string,
    dto: UpdateSubscriptionDto,
  ): Promise<NotificationSubscriptionEntity> {
    const subscription = await this.subscriptionRepository.findOne({ where: { id } });
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (dto.wechatEnabled !== undefined) {
      subscription.wechatEnabled = dto.wechatEnabled;
    }
    if (dto.smsEnabled !== undefined) {
      subscription.smsEnabled = dto.smsEnabled;
    }
    if (dto.inAppEnabled !== undefined) {
      subscription.inAppEnabled = dto.inAppEnabled;
    }

    const saved = await this.subscriptionRepository.save(subscription);

    const cacheKey = SUBSCRIPTION_CACHE_PREFIX + subscription.userId + ':' + subscription.templateType;
    await this.cacheService.delete(cacheKey);

    return saved;
  }

  private async incrementSubscriptionSentCount(
    userId: string,
    templateType: SubscriptionTemplateType,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, templateType },
    });
    if (subscription) {
      subscription.sentCount += 1;
      await this.subscriptionRepository.save(subscription);
    }
  }

  async findAll(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<{ list: NotificationEntity[]; total: number; unreadCount: number }> {
    const { page = 1, pageSize = 20, type, status, isRead } = query;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId });

    if (type) {
      queryBuilder.andWhere('n.type = :type', { type });
    }
    if (status) {
      queryBuilder.andWhere('n.status = :status', { status });
    }
    if (isRead !== undefined) {
      queryBuilder.andWhere('n.isRead = :isRead', { isRead });
    }

    queryBuilder.orderBy('n.createdAt', 'DESC');

    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return { list, total, unreadCount };
  }

  async findOne(id: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  }

  async markAsRead(userId: string, id?: string, all?: boolean): Promise<void> {
    if (all) {
      await this.notificationRepository
        .createQueryBuilder()
        .update(NotificationEntity)
        .set({ isRead: true, readAt: new Date() })
        .where('userId = :userId', { userId })
        .andWhere('isRead = :isRead', { isRead: false })
        .execute();
    } else if (id) {
      await this.notificationRepository
        .createQueryBuilder()
        .update(NotificationEntity)
        .set({ isRead: true, readAt: new Date() })
        .where('id = :id', { id })
        .andWhere('userId = :userId', { userId })
        .execute();
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async retryFailed(notificationId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status !== 'failed') {
      throw new Error('Only failed notifications can be retried');
    }

    notification.status = 'pending';
    notification.errorMessage = '';
    notification.retryCount = (notification.retryCount || 0) + 1;

    const saved = await this.notificationRepository.save(notification);

    await this.mqService.send('notification_push', 'retry', {
      notificationId: saved.id,
    });

    return saved;
  }

  getTemplateConfig(): Record<string, { templateType: string; title: string; defaultTemplateId: string }> {
    return {
      liability_determined: {
        templateType: 'liability_determined',
        title: '定责完成通知',
        defaultTemplateId: process.env.WX_TEMPLATE_LIABILITY || 'TMPL_LIABILITY',
      },
      certificate_generated: {
        templateType: 'certificate_generated',
        title: '认定书生成通知',
        defaultTemplateId: process.env.WX_TEMPLATE_CERTIFICATE || 'TMPL_CERTIFICATE',
      },
      appeal_result: {
        templateType: 'appeal_result',
        title: '复核结果通知',
        defaultTemplateId: process.env.WX_TEMPLATE_APPEAL || 'TMPL_APPEAL',
      },
      evidence_supplement_reminder: {
        templateType: 'evidence_supplement_reminder',
        title: '证据补充提醒',
        defaultTemplateId: process.env.WX_TEMPLATE_EVIDENCE || 'TMPL_EVIDENCE',
      },
    };
  }

  getSmsTemplateConfig(): Record<string, string> {
    return {
      liability_determined: process.env.SMS_TEMPLATE_LIABILITY || 'SMS_LIABILITY',
      certificate_generated: process.env.SMS_TEMPLATE_CERTIFICATE || 'SMS_CERTIFICATE',
      appeal_result: process.env.SMS_TEMPLATE_APPEAL || 'SMS_APPEAL',
      evidence_supplement_reminder: process.env.SMS_TEMPLATE_EVIDENCE || 'SMS_EVIDENCE',
    };
  }

  async buildAndPushLiabilityNotification(
    accident: any,
    partyAInfo: { userId?: string; openid?: string; phone?: string },
    partyBInfo: { userId?: string; openid?: string; phone?: string },
  ): Promise<void> {
    const liabilityResult = accident.liabilityResult || {};
    const content = `事故编号：${accident.reportNo}\n责任结果：${liabilityResult.liabilityDescription || '已完成定责'}`;

    await this.pushToBothParties({
      type: 'liability_determined',
      accidentId: accident.id,
      accidentReportNo: accident.reportNo,
      title: '定责完成通知',
      content,
      data: {
        thing1: accident.reportNo,
        thing2: liabilityResult.liabilityDescription || '已完成定责',
        thing3: liabilityResult.officer || '系统自动判定',
      },
      pagePath: '/pages/accident-detail/index?id=' + accident.id,
      channels: ['wechat_subscribe', 'sms', 'in_app'],
      partyA: partyAInfo,
      partyB: partyBInfo,
    });
  }

  async buildAndPushCertificateNotification(
    accident: any,
    certificate: any,
    partyAInfo: { userId?: string; openid?: string; phone?: string },
    partyBInfo: { userId?: string; openid?: string; phone?: string },
  ): Promise<void> {
    const content = `事故编号：${accident.reportNo}\n认定书号：${certificate.certificateNo}\n认定书已生成，请查收`;

    await this.pushToBothParties({
      type: 'certificate_generated',
      accidentId: accident.id,
      accidentReportNo: accident.reportNo,
      title: '认定书生成通知',
      content,
      data: {
        thing1: accident.reportNo,
        thing2: certificate.certificateNo,
        thing3: '请在小程序内查看',
      },
      pagePath: '/pages/certificate-detail/index?id=' + certificate.id,
      channels: ['wechat_subscribe', 'sms', 'in_app'],
      partyA: partyAInfo,
      partyB: partyBInfo,
    });
  }

  async buildAndPushAppealNotification(
    appeal: any,
    accident: any,
    partyInfo: { userId?: string; openid?: string; phone?: string },
  ): Promise<void> {
    const resultText = appeal.status === 'approved' ? '申诉通过' : '申诉驳回';
    const content = `申诉编号：${appeal.appealNo}\n复核结果：${resultText}\n${appeal.reviewComment || ''}`;

    await this.pushNotification({
      type: 'appeal_result',
      userId: partyInfo.userId,
      openid: partyInfo.openid,
      phone: partyInfo.phone,
      accidentId: accident.id,
      accidentReportNo: accident.reportNo,
      title: '复核结果通知',
      content,
      data: {
        thing1: appeal.appealNo,
        thing2: resultText,
        thing3: appeal.reviewComment || '请查看详情',
      },
      pagePath: '/pages/appeal/index?id=' + appeal.id,
      channels: ['wechat_subscribe', 'sms', 'in_app'],
    });
  }

  async buildAndPushEvidenceReminder(
    accident: any,
    reminder: string,
    partyInfo: { userId?: string; openid?: string; phone?: string },
  ): Promise<void> {
    const content = `事故编号：${accident.reportNo}\n补充说明：${reminder}`;

    await this.pushNotification({
      type: 'evidence_supplement_reminder',
      userId: partyInfo.userId,
      openid: partyInfo.openid,
      phone: partyInfo.phone,
      accidentId: accident.id,
      accidentReportNo: accident.reportNo,
      title: '证据补充提醒',
      content,
      data: {
        thing1: accident.reportNo,
        thing2: reminder,
        thing3: '请尽快补充相关证据',
      },
      pagePath: '/pages/accident-detail/index?id=' + accident.id,
      channels: ['wechat_subscribe', 'sms', 'in_app'],
    });
  }
}
