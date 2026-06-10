import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async log(params: {
    action: string;
    accidentId?: string;
    targetId?: string;
    targetType?: string;
    operatorId?: string;
    operatorName?: string;
    operatorRole?: string;
    beforeValue?: any;
    afterValue?: any;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntity> {
    const entry = this.auditLogRepository.create(params);
    const saved = await this.auditLogRepository.save(entry);
    this.logger.log('审计日志: ' + params.action + ' by ' + (params.operatorName || 'system'));
    return saved;
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
    action?: string;
    accidentId?: string;
    operatorId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ list: AuditLogEntity[]; total: number }> {
    const { page = 1, pageSize = 20, action, accidentId, operatorId, startDate, endDate } = params || {};

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.accident', 'accident')
      .orderBy('log.createdAt', 'DESC');

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }
    if (accidentId) {
      queryBuilder.andWhere('log.accidentId = :accidentId', { accidentId });
    }
    if (operatorId) {
      queryBuilder.andWhere('log.operatorId = :operatorId', { operatorId });
    }
    if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate });
    }

    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async findByAccidentId(accidentId: string): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { accidentId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRecent(count: number = 20): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: count,
    });
  }

  async getActionStats(days: number = 30): Promise<Array<{ action: string; count: number }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt >= :since', { since })
      .groupBy('log.action')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map((r) => ({
      action: r.action,
      count: parseInt(r.count, 10),
    }));
  }
}
