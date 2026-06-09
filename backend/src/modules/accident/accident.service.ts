import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { AccidentEntity, AccidentStatus, AccidentType } from './accident.entity';
import { VehicleEntity } from './vehicle.entity';
import { PhotoEntity } from './photo.entity';
import { CreateAccidentDto, DetermineLiabilityDto, SaveDraftDto, ReviewLiabilityDto } from './accident.dto';
import { LiabilityRuleEngine, LiabilityFact } from './liability-rule-engine';

const DRAFT_KEY_PREFIX = 'draft:accident:';
const DRAFT_TTL_SECONDS = 86400;

@Injectable()
export class AccidentService {
  private draftStore: Map<string, { data: any; expiresAt: number }> = new Map();

  constructor(
    @InjectRepository(AccidentEntity)
    private accidentRepository: Repository<AccidentEntity>,
    @InjectRepository(VehicleEntity)
    private vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(PhotoEntity)
    private photoRepository: Repository<PhotoEntity>,
    private readonly ruleEngine: LiabilityRuleEngine,
  ) {}

  async create(dto: CreateAccidentDto, userId?: string): Promise<AccidentEntity> {
    console.log('[AccidentService] 创建事故报案:', dto);

    if (!dto.integrityConfirmed) {
      throw new BadRequestException('必须确认诚信申报承诺后才能提交');
    }

    const reportNo = this.generateReportNo();

    const accident = this.accidentRepository.create({
      reportNo,
      status: 'pending',
      occurTime: dto.accidentTime ? new Date(dto.accidentTime) : new Date(),
      location: dto.location,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accidentType: dto.accidentType as AccidentType,
      description: dto.description || '',
      weather: dto.weather || '晴',
      roadCondition: dto.roadCondition || '干燥',
      collisionPositions: dto.collisionPositions || null,
      laneCrossingA: dto.laneCrossingA || false,
      laneCrossingB: dto.laneCrossingB || false,
      hasDashcamVideo: dto.hasDashcamVideo || false,
      dashcamVideoUrl: dto.dashcamVideoUrl || null,
      integrityConfirmed: dto.integrityConfirmed,
      reviewStatus: 'none',
      createdBy: userId,
    });

    const savedAccident = await this.accidentRepository.save(accident);

    for (let i = 0; i < dto.vehicles.length; i++) {
      const vehicleDto = dto.vehicles[i];
      const vehicle = this.vehicleRepository.create({
        accidentId: savedAccident.id,
        plateNo: vehicleDto.plateInfo.plateNo,
        plateColor: vehicleDto.plateInfo.plateColor,
        vehicleType: vehicleDto.plateInfo.vehicleType,
        confidence: vehicleDto.plateInfo.confidence,
        platePhotoUrl: vehicleDto.platePhoto?.url,
        ownerName: vehicleDto.ownerName || null,
        ownerPhone: vehicleDto.ownerPhone || null,
        driverLicenseNo: vehicleDto.driverLicenseNo || null,
        insuranceCompany: vehicleDto.insuranceCompany || null,
        vehicleOrder: i + 1,
      });
      await this.vehicleRepository.save(vehicle);
    }

    for (const photoDto of (dto.scenePhotos || [])) {
      const photo = this.photoRepository.create({
        accidentId: savedAccident.id,
        type: photoDto.type,
        url: photoDto.url,
        thumbnailUrl: photoDto.thumbnailUrl,
        watermarkInfo: photoDto.watermarkInfo,
      });
      await this.photoRepository.save(photo);
    }

    savedAccident.status = 'processing';
    await this.accidentRepository.save(savedAccident);

    console.log('[AccidentService] 事故报案创建成功:', savedAccident.id);
    return this.findOne(savedAccident.id);
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
  }): Promise<{ list: AccidentEntity[]; total: number }> {
    const { page = 1, pageSize = 10, status, userId } = params || {};

    const queryBuilder = this.accidentRepository
      .createQueryBuilder('accident')
      .leftJoinAndSelect('accident.vehicles', 'vehicles')
      .leftJoinAndSelect('accident.scenePhotos', 'scenePhotos')
      .orderBy('accident.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('accident.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('accident.createdBy = :userId', { userId });
    }

    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async findOne(id: string): Promise<AccidentEntity> {
    const accident = await this.accidentRepository.findOne({
      where: { id },
      relations: ['vehicles', 'scenePhotos'],
    });

    if (!accident) {
      throw new NotFoundException(`事故记录 ${id} 不存在`);
    }

    return accident;
  }

  async determineLiability(
    accidentId: string,
    dto: DetermineLiabilityDto,
  ): Promise<AccidentEntity> {
    console.log('[AccidentService] 责任判定:', accidentId);

    const accident = await this.findOne(accidentId);

    const fact = this.buildFactFromAccident(accident);

    const conclusion = await this.ruleEngine.evaluate(fact);

    console.log('[AccidentService] 规则引擎判定结果:', {
      ruleId: conclusion.ruleId,
      ruleName: conclusion.ruleName,
      ruleType: conclusion.ruleType,
      primaryParty: conclusion.primaryParty,
      liabilityType: conclusion.liabilityType,
      needsManualReview: conclusion.needsManualReview,
      confidence: conclusion.confidence,
    });

    const vehicles = accident.vehicles || [];
    const vehicleA = vehicles.find((v) => v.vehicleOrder === 1) || vehicles[0];
    const vehicleB = vehicles.find((v) => v.vehicleOrder === 2) || vehicles[1];

    let primaryPlateNo = '';
    let secondaryPlateNo = '';

    if (conclusion.primaryParty === 'A') {
      primaryPlateNo = vehicleA?.plateNo || 'A车';
      secondaryPlateNo = vehicleB?.plateNo || 'B车';
    } else if (conclusion.primaryParty === 'B') {
      primaryPlateNo = vehicleB?.plateNo || 'B车';
      secondaryPlateNo = vehicleA?.plateNo || 'A车';
    } else {
      primaryPlateNo = vehicleA?.plateNo || 'A车';
      secondaryPlateNo = vehicleB?.plateNo || 'B车';
    }

    accident.liabilityResult = {
      primaryParty: primaryPlateNo,
      secondaryParty: secondaryPlateNo,
      primaryLiability: conclusion.primaryLiability,
      secondaryLiability: conclusion.secondaryLiability,
      liabilityType: conclusion.liabilityType,
      liabilityDescription: conclusion.liabilityDescription,
      ruleId: conclusion.ruleId,
      ruleName: conclusion.ruleName,
      ruleType: conclusion.ruleType,
      legalBasis: conclusion.legalBasis,
      confidence: conclusion.confidence,
      needsManualReview: conclusion.needsManualReview,
      reviewReason: conclusion.reviewReason,
      determinedAt: new Date(),
      officer: dto?.officer || '系统自动判定',
    };

    if (conclusion.needsManualReview) {
      accident.status = 'manual_review';
      accident.reviewStatus = 'pending';
      console.log('[AccidentService] 需人工审核，原因:', conclusion.reviewReason);
    } else {
      accident.status = 'completed';
      accident.reviewStatus = 'none';
    }

    return await this.accidentRepository.save(accident);
  }

  private buildFactFromAccident(accident: AccidentEntity): LiabilityFact {
    const collisionPositions = accident.collisionPositions || { vehicleA: [], vehicleB: [] };

    const vehicleAPosition = collisionPositions.vehicleA?.join(',') || '';
    const vehicleBPosition = collisionPositions.vehicleB?.join(',') || '';

    return {
      accidentType: accident.accidentType,
      collisionPositions,
      laneCrossingA: accident.laneCrossingA || false,
      laneCrossingB: accident.laneCrossingB || false,
      hasDashcamVideo: accident.hasDashcamVideo || false,
      weather: accident.weather,
      roadCondition: accident.roadCondition,
      vehicleAPosition,
      vehicleBPosition,
    };
  }

  async reviewLiability(
    accidentId: string,
    dto: ReviewLiabilityDto,
  ): Promise<AccidentEntity> {
    console.log('[AccidentService] 人工审核责任判定:', accidentId);

    const accident = await this.findOne(accidentId);

    if (accident.reviewStatus !== 'pending') {
      throw new BadRequestException('该事故不在待审核状态');
    }

    accident.reviewResult = {
      reviewer: dto.reviewer || '交警在线复核',
      reviewedAt: new Date(),
      primaryParty: dto.primaryParty,
      primaryLiability: dto.primaryLiability,
      secondaryLiability: dto.secondaryLiability,
      liabilityDescription: dto.liabilityDescription,
      reviewComment: dto.reviewComment || '',
    };

    accident.reviewStatus = 'approved';
    accident.status = 'completed';

    if (accident.liabilityResult) {
      accident.liabilityResult.primaryParty = dto.primaryParty;
      accident.liabilityResult.primaryLiability = dto.primaryLiability;
      accident.liabilityResult.secondaryLiability = dto.secondaryLiability;
      accident.liabilityResult.liabilityDescription = dto.liabilityDescription;
      accident.liabilityResult.officer = dto.reviewer || '交警在线复核';
      accident.liabilityResult.determinedAt = new Date();
    }

    return await this.accidentRepository.save(accident);
  }

  async getReviewList(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<{ list: AccidentEntity[]; total: number }> {
    const { page = 1, pageSize = 20 } = params || {};

    const [list, total] = await this.accidentRepository
      .createQueryBuilder('accident')
      .leftJoinAndSelect('accident.vehicles', 'vehicles')
      .leftJoinAndSelect('accident.scenePhotos', 'scenePhotos')
      .where('accident.reviewStatus = :reviewStatus', { reviewStatus: 'pending' })
      .orderBy('accident.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async saveDraft(dto: SaveDraftDto, userId?: string): Promise<{ draftId: string }> {
    const draftId = dto.draftId || uuidv4();
    const key = DRAFT_KEY_PREFIX + (userId || 'anonymous') + ':' + draftId;

    this.draftStore.set(key, {
      data: dto.data || {},
      expiresAt: Date.now() + DRAFT_TTL_SECONDS * 1000,
    });

    console.log('[AccidentService] 草稿保存成功:', draftId);
    return { draftId };
  }

  async getDraft(userId?: string): Promise<{ draftId: string; data: any } | null> {
    const prefix = DRAFT_KEY_PREFIX + (userId || 'anonymous') + ':';

    for (const [key, value] of this.draftStore.entries()) {
      if (key.startsWith(prefix)) {
        if (value.expiresAt > Date.now()) {
          const draftId = key.replace(prefix, '');
          return { draftId, data: value.data };
        } else {
          this.draftStore.delete(key);
        }
      }
    }

    return null;
  }

  async deleteDraft(draftId: string, userId?: string): Promise<void> {
    const key = DRAFT_KEY_PREFIX + (userId || 'anonymous') + ':' + draftId;
    this.draftStore.delete(key);
    console.log('[AccidentService] 草稿已删除:', draftId);
  }

  async updateStatus(id: string, status: AccidentStatus): Promise<AccidentEntity> {
    const accident = await this.findOne(id);
    accident.status = status;
    return await this.accidentRepository.save(accident);
  }

  async getStatistics(userId?: string): Promise<{ total: number; pending: number; processing: number; completed: number; manualReview: number }> {
    const queryBuilder = this.accidentRepository.createQueryBuilder('accident');

    if (userId) {
      queryBuilder.andWhere('accident.createdBy = :userId', { userId });
    }

    const total = await queryBuilder.getCount();

    const pending = await this.accidentRepository.count({
      where: { status: 'pending', ...(userId ? { createdBy: userId } : {}) },
    });

    const processing = await this.accidentRepository.count({
      where: { status: 'processing', ...(userId ? { createdBy: userId } : {}) },
    });

    const completed = await this.accidentRepository.count({
      where: { status: 'completed', ...(userId ? { createdBy: userId } : {}) },
    });

    const manualReview = await this.accidentRepository.count({
      where: { status: 'manual_review', ...(userId ? { createdBy: userId } : {}) },
    });

    return { total, pending, processing, completed, manualReview };
  }

  private generateReportNo(): string {
    const prefix = 'BA' + dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return prefix + random;
  }
}
