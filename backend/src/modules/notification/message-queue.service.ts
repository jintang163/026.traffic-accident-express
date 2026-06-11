import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export type QueueName = 'notification_push' | 'sms_send' | 'wechat_push';

interface QueueMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  createdAt: number;
}

interface QueueConsumer<T = any> {
  queue: QueueName;
  handler: (message: QueueMessage<T>) => Promise<void>;
}

@Injectable()
export class MessageQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageQueueService.name);
  private queues: Map<QueueName, QueueMessage[]> = new Map();
  private consumers: QueueConsumer[] = [];
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.isRunning = true;
    this.startPolling();
    this.logger.log('Message queue service initialized (in-memory mode)');
  }

  onModuleDestroy() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.logger.log('Message queue service destroyed');
  }

  private startPolling() {
    this.pollInterval = setInterval(() => {
      this.processQueues().catch((err) => {
        this.logger.error('Queue processing error: ' + err.message);
      });
    }, 1000);
  }

  private async processQueues() {
    for (const consumer of this.consumers) {
      const queue = this.queues.get(consumer.queue) || [];
      if (queue.length === 0) continue;

      const message = queue.shift();
      if (message) {
        this.queues.set(consumer.queue, queue);
        try {
          await consumer.handler(message);
          this.logger.debug(`Message processed: ${consumer.queue}/${message.id}`);
        } catch (err) {
          this.logger.error(`Message processing failed: ${consumer.queue}/${message.id} - ${err.message}`);
          if (message.retryCount === undefined) {
            (message as any).retryCount = 0;
          }
          (message as any).retryCount++;
          if ((message as any).retryCount < 3) {
            queue.unshift(message);
            this.queues.set(consumer.queue, queue);
          }
        }
      }
    }
  }

  async send<T>(queue: QueueName, type: string, payload: T): Promise<string> {
    const message: QueueMessage<T> = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type,
      payload,
      createdAt: Date.now(),
    };

    if (!this.queues.has(queue)) {
      this.queues.set(queue, []);
    }
    this.queues.get(queue)!.push(message);
    this.logger.debug(`Message sent: ${queue}/${message.id}`);
    return message.id;
  }

  subscribe<T>(queue: QueueName, handler: (message: QueueMessage<T>) => Promise<void>): void {
    this.consumers.push({ queue, handler: handler as any });
    this.logger.log(`Consumer subscribed to queue: ${queue}`);
  }

  async getQueueSize(queue: QueueName): Promise<number> {
    return this.queues.get(queue)?.length || 0;
  }
}
