import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { AppealEntity, AppealStatus } from './appeal.entity';
import { CreateAppealDto, ReviewAppealDto } from './appeal.dto';
import { AccidentService } from '../accident/accident.service';
import { SecurityVerifyService } from '../security/security-verify.service';

@Injectable()
export class AppealService {
  private readonly logger = new Logger(AppealService.name);

  constructor(
    @InjectRepository(AppealEntity)
    private appealRepository: Repository<AppealEntity>,
    private accidentService: AccidentService,
    private securityVerifyService: SecurityVerifyService,
  ) {}

  async create(dto: CreateAppealDto, userId?: string): Promise<AppealEntity> {
    this.logger.log('创建申诉: accidentId=' + dto.accidentId);

    const accident = await this.accidentService.findOne(dto.accidentId);

    const appealWindow = this.accidentService.getAppealWindow(accident);
    if (!appealWindow.canAppeal) {
      throw new BadRequestException(appealWindow.reason || '不可申诉');
    }

    const existing = await this.appealRepository.count({
      where: { accidentId: dto.accidentId, createdBy: userId, status: 'pending' },
    });
    if (existing > 0) {
      throw new BadRequestException('该事故已有待处理的申诉，请等待审核结果');
    }

    const verified = await this.securityVerifyService.verifyToken(dto.verifyToken, {
      action: 'appeal',
      targetId: dto.accidentId,
      userId,
    });
    if (!verified.valid) {
      throw new BadRequestException('身份验证失败：' + (verified.message || '请重新验证身份'));
    }

    const appealNo = this.generateAppealNo();

    const appeal = this.appealRepository.create({
      appealNo,
      accidentId: dto.accidentId,
      createdBy: userId,
      phone: verified.phone || '',
      verifyMethod: dto.verifyMethod || verified.method || 'sms',
      identityVerified: true,
      verifyTransactionId: verified.transactionId,
      reason: dto.reason,
      disputedPoints: dto.disputedPoints || [],
      dashcamVideoUrl: dto.dashcamVideoUrl || '',
      evidencePhotoUrls: dto.evidencePhotoUrls || [],
      additionalDescription: dto.additionalDescription || '',
      status: 'pending',
    });

    const saved = await this.appealRepository.save(appeal);
    this.logger.log('申诉创建成功: ' + saved.id);
    return saved;
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
    status?: AppealStatus;
    userId?: string;
    accidentId?: string;
  }): Promise<{ list: AppealEntity[]; total: number }> {
    const { page = 1, pageSize = 10, status, userId, accidentId } = params || {};

    const queryBuilder = this.appealRepository
      .createQueryBuilder('appeal')
      .leftJoinAndSelect('appeal.accident', 'accident')
      .orderBy('appeal.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('appeal.status = :status', { status });
    }
    if (userId) {
      queryBuilder.andWhere('appeal.createdBy = :userId', { userId });
    }
    if (accidentId) {
      queryBuilder.andWhere('appeal.accidentId = :accidentId', { accidentId });
    }

    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async findOne(id: string): Promise<AppealEntity> {
    const appeal = await this.appealRepository.findOne({
      where: { id },
      relations: ['accident'],
    });
    if (!appeal) {
      throw new NotFoundException('申诉记录不存在');
    }
    return appeal;
  }

  async findByAccidentId(accidentId: string, userId?: string): Promise<AppealEntity | null> {
    const where: any = { accidentId };
    if (userId) where.createdBy = userId;
    return this.appealRepository.findOne({
      where,
      order: { createdAt: 'DESC' },
      relations: ['accident'],
    });
  }

  async review(id: string, dto: ReviewAppealDto): Promise<AppealEntity> {
    const appeal = await this.findOne(id);

    if (appeal.status !== 'pending' && appeal.status !== 'reviewing') {
      throw new BadRequestException('当前申诉状态不可审核');
    }

    appeal.status = dto.result;
    appeal.reviewer = dto.reviewer || '人工复核员';
    appeal.reviewedAt = new Date();
    appeal.reviewComment = dto.reviewComment;
    appeal.reviewResult = dto.reviewResult || null;

    if (dto.result === 'approved' && dto.reviewResult) {
      try {
        await this.accidentService.reviewLiability(appeal.accidentId, {
          reviewer: appeal.reviewer,
          primaryParty: dto.reviewResult.primaryParty || appeal.accident.liabilityResult?.primaryParty || '',
          primaryLiability: dto.reviewResult.primaryLiability ?? appeal.accident.liabilityResult?.primaryLiability ?? 0,
          secondaryLiability: dto.reviewResult.secondaryLiability ?? appeal.accident.liabilityResult?.secondaryLiability ?? 0,
          liabilityDescription: dto.reviewResult.liabilityDescription || appeal.accident.liabilityResult?.liabilityDescription || '',
          reviewComment: dto.reviewComment,
        });
      } catch (e) {
        this.logger.error('申诉审核通过但更新事故责任失败: ' + e.message);
      }
    }

    const saved = await this.appealRepository.save(appeal);
    this.logger.log('申诉审核完成: ' + saved.id + ' -> ' + saved.status);
    return saved;
  }

  async withdraw(id: string, userId?: string): Promise<AppealEntity> {
    const appeal = await this.findOne(id);

    if (appeal.status !== 'pending') {
      throw new BadRequestException('仅待审核状态可撤回');
    }
    if (userId && appeal.createdBy && appeal.createdBy !== userId) {
      throw new BadRequestException('仅可撤回本人申诉');
    }

    appeal.status = 'withdrawn';
    return await this.appealRepository.save(appeal);
  }

  async getStatistics(userId?: string): Promise<{
    total: number; pending: number; reviewing: number; approved: number; rejected: number; withdrawn: number;
  }> {
    const where = userId ? { createdBy: userId } : {};
    const list = await this.appealRepository.find({ where });
    return {
      total: list.length,
      pending: list.filter(a => a.status === 'pending').length,
      reviewing: list.filter(a => a.status === 'reviewing').length,
      approved: list.filter(a => a.status === 'approved').length,
      rejected: list.filter(a => a.status === 'rejected').length,
      withdrawn: list.filter(a => a.status === 'withdrawn').length,
    };
  }

  async countByDateRange(start: Date, end: Date): Promise<number> {
    return this.appealRepository
      .createQueryBuilder('appeal')
      .where('appeal.createdAt >= :start', { start })
      .andWhere('appeal.createdAt <= :end', { end })
      .getCount();
  }

  private generateAppealNo(): string {
    const prefix = 'SS' + dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return prefix + random;
  }
}
