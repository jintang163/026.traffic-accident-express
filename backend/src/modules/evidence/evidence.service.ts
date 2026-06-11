import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { EvidenceEntity, EvidenceStatus, EvidenceType } from './evidence.entity';
import { PhotoEntity } from '../accident/photo.entity';
import { CreateEvidenceDto, QueryEvidenceDto, UpdateEvidenceStatusDto } from './evidence.dto';
import { HashAndChainService, HashResult, ChainResult } from './hash-and-chain.service';
import { CloudStorageService, UploadResult } from './cloud-storage.service';
import { ImageCompressionService } from './image-compression.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);
  private readonly MAX_PHOTOS_PER_ACCIDENT = 8;

  constructor(
    @InjectRepository(EvidenceEntity)
    private evidenceRepository: Repository<EvidenceEntity>,
    @InjectRepository(PhotoEntity)
    private photoRepository: Repository<PhotoEntity>,
    private hashAndChainService: HashAndChainService,
    private cloudStorageService: CloudStorageService,
    private imageCompressionService: ImageCompressionService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateEvidenceDto, file?: Express.Multer.File): Promise<EvidenceEntity> {
    this.logger.log(`创建证据记录: ${dto.fileName}`);

    const photoCount = await this.photoRepository.count({
      where: { accidentId: dto.accidentId },
    });

    if (dto.accidentId && photoCount >= this.MAX_PHOTOS_PER_ACCIDENT) {
      throw new BadRequestException(`每起事故最多上传${this.MAX_PHOTOS_PER_ACCIDENT}张照片`);
    }

    let uploadResult: UploadResult | undefined;
    let hashResult: HashResult | undefined;
    let chainResult: ChainResult | undefined;
    let compressionResult: { size: number; width: number; height: number } | undefined;

    if (file) {
      compressionResult = await this.imageCompressionService.compressImageBuffer(file.buffer, {
        targetSizeMB: 1.5,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      uploadResult = await this.cloudStorageService.uploadBuffer(
        compressionResult.buffer,
        dto.fileName,
        { folder: `evidence/${dto.accidentId || 'unknown'}` },
      );

      hashResult = await this.hashAndChainService.calculateBufferHash(compressionResult.buffer);

      const evidenceHash = this.hashAndChainService.generateEvidenceHash({
        accidentId: dto.accidentId || '',
        photoId: '',
        fileHash: hashResult.sha256,
        uploadTime: new Date(),
        gpsInfo: dto.gpsInfo,
        deviceInfo: dto.deviceInfo,
      });

      chainResult = await this.hashAndChainService.uploadToChain(evidenceHash, {
        fileName: dto.fileName,
        fileSize: compressionResult.size,
        accidentId: dto.accidentId,
        gpsInfo: dto.gpsInfo,
        deviceInfo: dto.deviceInfo,
      });
    }

    const evidenceId = this.hashAndChainService.generateEvidenceId();
    const expireDate = this.hashAndChainService.calculateExpireDate();

    const evidence = this.evidenceRepository.create({
      evidenceId,
      accidentId: dto.accidentId,
      photoId: dto.photoId,
      evidenceType: dto.evidenceType || 'photo',
      originalUrl: uploadResult?.url || dto.originalUrl,
      cdnUrl: uploadResult?.cdnUrl || dto.cdnUrl,
      fileName: dto.fileName,
      fileSize: compressionResult?.size || dto.fileSize || 0,
      fileFormat: dto.fileFormat || path.extname(dto.fileName).slice(1),
      mimeType: dto.mimeType,
      width: compressionResult?.width || dto.width || 0,
      height: compressionResult?.height || dto.height || 0,
      md5Hash: hashResult?.md5,
      sha1Hash: hashResult?.sha1,
      sha256Hash: hashResult?.sha256,
      evidenceHash: hashResult ? this.hashAndChainService.generateEvidenceHash({
        accidentId: dto.accidentId || '',
        photoId: '',
        fileHash: hashResult.sha256,
        uploadTime: new Date(),
        gpsInfo: dto.gpsInfo,
        deviceInfo: dto.deviceInfo,
      }) : '',
      isHashed: !!hashResult,
      isOnChain: chainResult?.success || false,
      chainProvider: chainResult?.provider,
      chainTxId: chainResult?.txId,
      chainBlockHeight: chainResult?.blockHeight,
      chainProof: chainResult?.proof,
      chainTime: chainResult?.timestamp,
      storageProvider: uploadResult?.provider || dto.storageProvider || 'local',
      storageBucket: uploadResult?.bucket || dto.storageBucket,
      storageKey: uploadResult?.key || dto.storageKey,
      gpsInfo: dto.gpsInfo,
      deviceInfo: dto.deviceInfo,
      watermarkInfo: dto.watermarkInfo,
      metadata: dto.metadata,
      status: chainResult?.success ? 'valid' : 'pending',
      expireDate,
      isExpired: false,
      isTampered: false,
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);

    if (dto.accidentId && file) {
      const photo = this.photoRepository.create({
        accidentId: dto.accidentId,
        type: 'scene',
        url: savedEvidence.originalUrl,
        thumbnailUrl: savedEvidence.cdnUrl,
        watermarkInfo: dto.watermarkInfo,
        size: savedEvidence.fileSize,
        mimeType: savedEvidence.mimeType,
        md5Hash: savedEvidence.md5Hash,
        sha256Hash: savedEvidence.sha256Hash,
        isHashed: savedEvidence.isHashed,
        isOnChain: savedEvidence.isOnChain,
        chainTxId: savedEvidence.chainTxId,
        chainTime: savedEvidence.chainTime,
        expireDate: savedEvidence.expireDate,
        uploadTime: new Date(),
        completedTime: new Date(),
        uploadStatus: 'completed',
        gpsInfo: dto.gpsInfo,
        deviceInfo: dto.deviceInfo,
      });

      await this.photoRepository.save(photo);

      savedEvidence.photoId = photo.id;
      await this.evidenceRepository.save(savedEvidence);
    }

    this.logger.log(`证据记录创建成功: ${evidenceId}`);

    return savedEvidence;
  }

  async findAll(query: QueryEvidenceDto): Promise<{ list: EvidenceEntity[]; total: number }> {
    const { page = 1, pageSize = 10, accidentId, photoId, status, evidenceType, isExpired, isOnChain } = query;

    const queryBuilder = this.evidenceRepository
      .createQueryBuilder('evidence')
      .orderBy('evidence.createdAt', 'DESC');

    if (accidentId) {
      queryBuilder.andWhere('evidence.accidentId = :accidentId', { accidentId });
    }

    if (photoId) {
      queryBuilder.andWhere('evidence.photoId = :photoId', { photoId });
    }

    if (status) {
      queryBuilder.andWhere('evidence.status = :status', { status });
    }

    if (evidenceType) {
      queryBuilder.andWhere('evidence.evidenceType = :evidenceType', { evidenceType });
    }

    if (isExpired !== undefined) {
      queryBuilder.andWhere('evidence.isExpired = :isExpired', { isExpired });
    }

    if (isOnChain !== undefined) {
      queryBuilder.andWhere('evidence.isOnChain = :isOnChain', { isOnChain });
    }

    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async findOne(id: string): Promise<EvidenceEntity> {
    const evidence = await this.evidenceRepository.findOne({ where: { id } });

    if (!evidence) {
      throw new NotFoundException(`证据记录 ${id} 不存在`);
    }

    return evidence;
  }

  async findByEvidenceId(evidenceId: string): Promise<EvidenceEntity> {
    const evidence = await this.evidenceRepository.findOne({ where: { evidenceId } });

    if (!evidence) {
      throw new NotFoundException(`证据ID ${evidenceId} 不存在`);
    }

    return evidence;
  }

  async verifyEvidence(id: string): Promise<{
    evidence: EvidenceEntity;
    isValid: boolean;
    isOnChain: boolean;
    verifyTime: Date;
  }> {
    const evidence = await this.findOne(id);

    let isValid = true;
    let isOnChain = evidence.isOnChain;

    if (evidence.storageKey) {
      const filePath = path.join(process.cwd(), 'uploads', evidence.storageKey);

      if (fs.existsSync(filePath)) {
        const verifyResult = await this.hashAndChainService.verifyEvidence(
          filePath,
          evidence.sha256Hash,
          'sha256',
          evidence.chainTxId ? {
            txId: evidence.chainTxId,
            blockHeight: evidence.chainBlockHeight || '',
            timestamp: evidence.chainTime || new Date(),
            provider: evidence.chainProvider || 'mock',
          } : undefined,
        );

        isValid = verifyResult.isValid;
        isOnChain = verifyResult.chainInfo?.isOnChain || isOnChain;

        if (!isValid) {
          evidence.isTampered = true;
          evidence.status = 'tampered';
        }
      }
    }

    evidence.verifyCount++;
    evidence.lastVerifyTime = new Date();
    await this.evidenceRepository.save(evidence);

    return {
      evidence,
      isValid,
      isOnChain,
      verifyTime: new Date(),
    };
  }

  async updateStatus(id: string, dto: UpdateEvidenceStatusDto): Promise<EvidenceEntity> {
    const evidence = await this.findOne(id);

    evidence.status = dto.status;
    evidence.remark = dto.remark || evidence.remark;

    if (dto.status === 'revoked') {
      evidence.isExpired = true;
    }

    return await this.evidenceRepository.save(evidence);
  }

  async checkAndUpdateExpired(): Promise<number> {
    const now = new Date();

    const expiredEvidence = await this.evidenceRepository
      .createQueryBuilder('evidence')
      .where('evidence.expireDate <= :now', { now })
      .andWhere('evidence.isExpired = :isExpired', { isExpired: false })
      .andWhere('evidence.status = :status', { status: 'valid' })
      .getMany();

    for (const evidence of expiredEvidence) {
      evidence.isExpired = true;
      evidence.status = 'expired';
      await this.evidenceRepository.save(evidence);
    }

    this.logger.log(`已更新 ${expiredEvidence.length} 条过期证据记录`);

    return expiredEvidence.length;
  }

  async getStatistics(accidentId?: string): Promise<{
    total: number;
    valid: number;
    expired: number;
    tampered: number;
    onChain: number;
    totalSize: number;
  }> {
    const queryBuilder = this.evidenceRepository.createQueryBuilder('evidence');

    if (accidentId) {
      queryBuilder.where('evidence.accidentId = :accidentId', { accidentId });
    }

    const [list, total] = await queryBuilder.getManyAndCount();

    const valid = list.filter(e => e.status === 'valid').length;
    const expired = list.filter(e => e.status === 'expired').length;
    const tampered = list.filter(e => e.status === 'tampered').length;
    const onChain = list.filter(e => e.isOnChain).length;
    const totalSize = list.reduce((sum, e) => sum + (e.fileSize || 0), 0);

    return { total, valid, expired, tampered, onChain, totalSize };
  }

  async getPhotoCount(accidentId: string): Promise<{ count: number; max: number }> {
    const count = await this.photoRepository.count({
      where: { accidentId },
    });

    return { count, max: this.MAX_PHOTOS_PER_ACCIDENT };
  }

  async sendEvidenceReminder(
    accidentId: string,
    reminder: string,
    partyInfo: { userId?: string; openid?: string; phone?: string },
    accident?: any,
  ): Promise<void> {
    this.logger.log(`发送证据补充提醒: accidentId=${accidentId}`);

    if (!accident) {
      this.logger.warn('事故信息缺失，无法发送证据补充提醒');
      return;
    }

    await this.notificationService.buildAndPushEvidenceReminder(
      accident,
      reminder,
      partyInfo,
    );
  }
}
