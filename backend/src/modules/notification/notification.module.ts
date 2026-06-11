import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './notification.entity';
import { NotificationSubscriptionEntity } from './notification-subscription.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { WechatSubscribeService } from './wechat-subscribe.service';
import { SmsService } from './sms.service';
import { MessageQueueService } from './message-queue.service';
import { CacheService } from './cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, NotificationSubscriptionEntity]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    WechatSubscribeService,
    SmsService,
    MessageQueueService,
    CacheService,
  ],
  exports: [
    NotificationService,
    WechatSubscribeService,
    SmsService,
    MessageQueueService,
    CacheService,
  ],
})
export class NotificationModule {}
