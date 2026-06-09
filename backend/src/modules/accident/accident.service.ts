import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { AccidentEntity, AccidentStatus, AccidentType } from './accident.entity';
import { VehicleEntity } from './vehicle.entity';
import { PhotoEntity } from './photo.entity';
import { CreateAccidentDto, DetermineLiabilityDto, SaveDraftDto } from './accident.dto';
import { validateAccidentReport } from '../../utils/validator';

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
      occurTime: new Date(),
      location: dto.location,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accidentType: dto.accidentType as AccidentType,
      description: dto.description,
      weather: dto.weather,
      roadCondition: dto.roadCondition,
      collisionPositions: dto.collisionPositions || null,
      integrityConfirmed: dto.integrityConfirmed,
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
        ownerName: vehicleDto.ownerName,
        ownerPhone: vehicleDto.ownerPhone,
        driverLicenseNo: vehicleDto.driverLicenseNo || null,
        insuranceCompany: vehicleDto.insuranceCompany,
        vehicleOrder: i + 1,
      });
      await this.vehicleRepository.save(vehicle);
    }

    for (const photoDto of dto.scenePhotos) {
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

    const liabilityResult = this.calculateLiability(accident);

    accident.liabilityResult = {
      ...liabilityResult,
      determinedAt: new Date(),
      officer: dto.officer || '系统自动判定',
    };
    accident.status = 'completed';

    return await this.accidentRepository.save(accident);
  }

  private calculateLiability(accident: AccidentEntity) {
    const { accidentType, vehicles } = accident;

    if (vehicles.length < 2) {
      return {
        primaryParty: vehicles[0]?.plateNo || '',
        secondaryParty: '',
        primaryLiability: 100,
        secondaryLiability: 0,
        liabilityDescription: '单方事故，驾驶员承担全部责任',
      };
    }

    const primaryVehicle = vehicles[1] || vehicles[0];
    const secondaryVehicle = vehicles[0];

    const liabilityRules: Record<string, { primary: number; secondary: number; description: string }> = {
      rear_end: {
        primary: 100,
        secondary: 0,
        description: '后车未保持安全车距，负全部责任',
      },
      side_swipe: {
        primary: 70,
        secondary: 30,
        description: '变道车辆未观察相邻车道情况，负主要责任；另一方未保持安全车距，负次要责任',
      },
      head_on: {
        primary: 50,
        secondary: 50,
        description: '双方均未注意观察路况，负同等责任',
      },
      reverse: {
        primary: 100,
        secondary: 0,
        description: '倒车车辆未查明车后情况，负全部责任',
      },
      intersection: {
        primary: 60,
        secondary: 40,
        description: '未让行车辆负主要责任，另一方负次要责任',
      },
      other: {
        primary: 50,
        secondary: 50,
        description: '事故责任需进一步调查，暂按同等责任处理',
      },
    };

    const rule = liabilityRules[accidentType] || liabilityRules.other;

    return {
      primaryParty: primaryVehicle.plateNo,
      secondaryParty: secondaryVehicle.plateNo,
      primaryLiability: rule.primary,
      secondaryLiability: rule.secondary,
      liabilityDescription: rule.description,
    };
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

  private generateReportNo(): string {
    const prefix = 'BA' + dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return prefix + random;
  }
}
