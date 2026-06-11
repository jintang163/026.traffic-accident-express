import { Controller, Get, Post, Put, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  SubscribeTemplateDto,
  UpdateSubscriptionDto,
  QueryNotificationDto,
  MarkReadDto,
} from './notification.dto';
import { WechatSubscribeService } from './wechat-subscribe.service';
import { SmsService } from './sms.service';

@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly wechatService: WechatSubscribeService,
    private readonly smsService: SmsService,
  ) {}

  private getUserId(req: any): string {
    return req.user?.id || req.user?.sub || '';
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = this.getUserId(req);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Get('templates/wechat')
  async getWechatTemplates() {
    const templates = await this.wechatService.getTemplateList();
    return { templates };
  }

  @Get('templates/config')
  async getTemplateConfig() {
    return this.notificationService.getTemplateConfig();
  }

  @Get('subscriptions')
  async getSubscriptions(@Req() req: any) {
    const userId = this.getUserId(req);
    const subscriptions = await this.notificationService.getUserSubscriptions(userId);
    return { subscriptions };
  }

  @Post('subscriptions')
  async subscribeTemplate(@Req() req: any, @Body() dto: SubscribeTemplateDto) {
    const userId = this.getUserId(req);
    return this.notificationService.subscribeTemplate(userId, dto);
  }

  @Put('subscriptions/:id')
  async updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.notificationService.updateSubscription(id, dto);
  }

  @Post('mark-read')
  async markAsRead(@Req() req: any, @Body() dto: MarkReadDto) {
    const userId = this.getUserId(req);
    await this.notificationService.markAsRead(userId, dto.id, dto.all);
    return { success: true };
  }

  @Post('retry/:id')
  async retryNotification(@Param('id') id: string) {
    return this.notificationService.retryFailed(id);
  }

  @Post('send')
  async sendNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationService.pushNotification(dto);
  }

  @Get('sms/provider')
  async getSmsProvider() {
    return { provider: this.smsService.getProvider() };
  }

  @Get()
  async getNotifications(@Req() req: any, @Query() query: QueryNotificationDto) {
    const userId = this.getUserId(req);
    return this.notificationService.findAll(userId, query);
  }

  @Get(':id')
  async getNotification(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }
}
