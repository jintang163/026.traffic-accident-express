import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { CertificateEntity, CertificateStatus } from './certificate.entity';
import { AccidentService } from '../accident/accident.service';
import { getAccidentTypeText } from '../../utils/validator';
import { PdfGeneratorService } from './pdf-generator.service';
import { ElectronicSignatureService } from './electronic-signature.service';
import { QrCodeService } from './qrcode.service';
import { CloudStorageService } from '../evidence/cloud-storage.service';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectRepository(CertificateEntity)
    private certificateRepository: Repository<CertificateEntity>,
    private accidentService: AccidentService,
    private pdfGeneratorService: PdfGeneratorService,
    private electronicSignatureService: ElectronicSignatureService,
    private qrCodeService: QrCodeService,
    private cloudStorageService: CloudStorageService,
  ) {}

  async generate(accidentId: string, userId?: string): Promise<CertificateEntity> {
    this.logger.log('生成认定书: ' + accidentId);

    const existing = await this.certificateRepository.findOne({
      where: { accidentId },
    });

    if (existing) {
      return existing;
    }

    const accident = await this.accidentService.findOne(accidentId);

    if (!accident.liabilityResult) {
      throw new BadRequestException('事故责任尚未判定，请先完成责任认定');
    }

    const certificateNo = this.generateCertificateNo();
    const verifyCode = this.generateVerifyCode();

    const parties = accident.vehicles.map((vehicle, index) => {
      const isPrimary = vehicle.plateNo === accident.liabilityResult!.primaryParty;
      const isSecondary = vehicle.plateNo === accident.liabilityResult!.secondaryParty;

      let liability: 'full' | 'primary' | 'secondary' | 'none' = 'none';
      if (isPrimary && accident.liabilityResult!.primaryLiability === 100) {
        liability = 'full';
      } else if (isPrimary) {
        liability = 'primary';
      } else if (isSecondary) {
        liability = 'secondary';
      }

      return {
        id: uuidv4(),
        name: vehicle.ownerName || '当事人' + (index + 1),
        idCardNo: '',
        phone: vehicle.ownerPhone || '',
        plateNo: vehicle.plateNo,
        insuranceCompany: vehicle.insuranceCompany || '',
        liability,
      };
    });

    const certificateContent = this.generateCertificateContent(
      certificateNo,
      accident,
      parties,
    );

    const certificate = this.certificateRepository.create({
      certificateNo,
      accidentId,
      parties,
      certificateContent,
      status: 'issued',
      issuedAt: new Date(),
      issuedBy: '北京市公安局公安交通管理局',
      validUntil: dayjs().add(5, 'year').toDate(),
      verifyCode,
      createdBy: userId,
    });

    const saved = await this.certificateRepository.save(certificate);
    this.logger.log('认定书生成成功: ' + saved.id);

    this.generateAndUploadPdf(saved.id).catch((err) => {
      this.logger.error('PDF异步生成失败: ' + err.message);
    });

    return saved;
  }

  async generateAndUploadPdf(certificateId: string): Promise<CertificateEntity> {
    this.logger.log('开始生成PDF: ' + certificateId);

    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId },
      relations: ['accident'],
    });

    if (!certificate) {
      throw new NotFoundException('认定书 ' + certificateId + ' 不存在');
    }

    const accident = certificate.accident || await this.accidentService.findOne(certificate.accidentId);

    const qrCodeBuffer = await this.qrCodeService.generateVerificationQrCode(
      certificate.certificateNo,
      certificate.verifyCode,
    );

    const liabilityTextMap: Record<string, string> = {
      full: '全部责任',
      primary: '主要责任',
      secondary: '次要责任',
      none: '无责任',
    };

    const pdfData = {
      certificateNo: certificate.certificateNo,
      accidentTime: dayjs(accident.occurTime).format('YYYY年MM月DD日HH时mm分'),
      location: accident.location,
      accidentType: getAccidentTypeText(accident.accidentType),
      description: accident.description || certificate.certificateContent,
      parties: certificate.parties.map((p) => ({
        name: p.name,
        plateNo: p.plateNo,
        vehicleType: '小型轿车',
        insuranceCompany: p.insuranceCompany,
        liability: liabilityTextMap[p.liability] || '无责任',
        phone: p.phone,
      })),
      liabilityConclusion: accident.liabilityResult?.liabilityDescription || '',
      legalBasis: accident.liabilityResult?.legalBasis || '',
      primaryLiability: accident.liabilityResult?.primaryLiability || 0,
      secondaryLiability: accident.liabilityResult?.secondaryLiability || 0,
      officer: accident.liabilityResult?.officer || '系统自动判定',
      department: certificate.issuedBy,
      issuedAt: dayjs(certificate.issuedAt).format('YYYY年MM月DD日'),
      sealText: certificate.issuedBy,
      qrCodeBuffer,
    };

    let pdfBuffer = await this.pdfGeneratorService.generateCertificatePdf(pdfData);

    const signResult = await this.electronicSignatureService.signPdf({
      certificateNo: certificate.certificateNo,
      pdfBuffer,
      sealType: 'police',
    });

    if (signResult.success && signResult.signedPdfBuffer) {
      pdfBuffer = signResult.signedPdfBuffer;
    }

    const fileName = certificate.certificateNo + '.pdf';
    const uploadResult = await this.cloudStorageService.uploadBuffer(pdfBuffer, fileName, {
      folder: 'certificates/' + dayjs().format('YYYY/MM/DD'),
    });

    let qrCodeUrl: string | null = null;
    try {
      const qrCodeBase64 = await this.qrCodeService.generateVerificationQrCodeBase64(
        certificate.certificateNo,
        certificate.verifyCode,
      );
      const qrCodeImageBuffer = Buffer.from(qrCodeBase64.split(',')[1], 'base64');
      const qrUploadResult = await this.cloudStorageService.uploadBuffer(
        qrCodeImageBuffer,
        certificate.certificateNo + '_qrcode.png',
        { folder: 'certificates/qrcode' },
      );
      qrCodeUrl = qrUploadResult.url;
    } catch (err) {
      this.logger.warn('QR码图片上传失败: ' + err.message);
    }

    certificate.pdfUrl = uploadResult.url;
    certificate.pdfStorageKey = uploadResult.key;
    certificate.qrCodeUrl = qrCodeUrl;
    certificate.signatureInfo = signResult.signatureInfo;
    certificate.pdfGeneratedAt = new Date();
    certificate.status = 'issued';

    const updated = await this.certificateRepository.save(certificate);
    this.logger.log('PDF生成并上传完成: ' + uploadResult.url);

    return updated;
  }

  async getPdfBuffer(certificateId: string): Promise<Buffer> {
    const certificate = await this.findOne(certificateId);

    if (!certificate.pdfUrl) {
      const updated = await this.generateAndUploadPdf(certificateId);
      if (!updated.pdfUrl) {
        throw new BadRequestException('PDF生成失败，请稍后重试');
      }
      certificate.pdfUrl = updated.pdfUrl;
      certificate.pdfStorageKey = updated.pdfStorageKey;
    }

    try {
      const axios = await import('axios');
      const response = await axios.default.get(certificate.pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('PDF下载失败: ' + error.message);
      throw new BadRequestException('PDF下载失败: ' + error.message);
    }
  }

  async regeneratePdf(certificateId: string): Promise<CertificateEntity> {
    this.logger.log('重新生成PDF: ' + certificateId);

    const certificate = await this.findOne(certificateId);
    return this.generateAndUploadPdf(certificateId);
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
  }): Promise<{ list: CertificateEntity[]; total: number }> {
    const { page = 1, pageSize = 10, status, userId } = params || {};

    const queryBuilder = this.certificateRepository
      .createQueryBuilder('certificate')
      .leftJoinAndSelect('certificate.accident', 'accident')
      .orderBy('certificate.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('certificate.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('certificate.createdBy = :userId', { userId });
    }

    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async findOne(id: string): Promise<CertificateEntity> {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
      relations: ['accident'],
    });

    if (!certificate) {
      throw new NotFoundException('认定书 ' + id + ' 不存在');
    }

    return certificate;
  }

  async verify(certificateNo: string, verifyCode: string): Promise<boolean> {
    const certificate = await this.certificateRepository.findOne({
      where: { certificateNo, verifyCode },
    });

    if (!certificate) {
      return false;
    }

    if (certificate.status === 'revoked') {
      return false;
    }

    if (new Date() > certificate.validUntil) {
      return false;
    }

    return true;
  }

  async share(id: string): Promise<{ shareUrl: string; verifyCode: string; qrCodeUrl?: string }> {
    const certificate = await this.findOne(id);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const shareUrl = baseUrl + '/certificate/verify?no=' + certificate.certificateNo + '&code=' + certificate.verifyCode;

    return {
      shareUrl,
      verifyCode: certificate.verifyCode,
      qrCodeUrl: certificate.qrCodeUrl,
    };
  }

  async download(id: string): Promise<{ url: string; qrCodeUrl?: string }> {
    const certificate = await this.findOne(id);

    if (!certificate.pdfUrl) {
      const updated = await this.generateAndUploadPdf(id);
      return { url: updated.pdfUrl, qrCodeUrl: updated.qrCodeUrl };
    }

    return { url: certificate.pdfUrl, qrCodeUrl: certificate.qrCodeUrl };
  }

  async getStatistics(userId?: string): Promise<{ total: number; issued: number; verified: number; revoked: number }> {
    const queryBuilder = this.certificateRepository.createQueryBuilder('certificate');

    if (userId) {
      queryBuilder.andWhere('certificate.createdBy = :userId', { userId });
    }

    const total = await queryBuilder.getCount();

    const issued = await this.certificateRepository.count({
      where: { status: 'issued', ...(userId ? { createdBy: userId } : {}) },
    });

    const verified = await this.certificateRepository.count({
      where: { status: 'verified', ...(userId ? { createdBy: userId } : {}) },
    });

    const revoked = await this.certificateRepository.count({
      where: { status: 'revoked', ...(userId ? { createdBy: userId } : {}) },
    });

    return { total, issued, verified, revoked };
  }

  async send(id: string, phone: string): Promise<{ success: boolean }> {
    const certificate = await this.findOne(id);

    this.logger.log('发送认定书到手机: ' + phone + ' 认定书号: ' + certificate.certificateNo);

    return { success: true };
  }

  private generateCertificateNo(): string {
    const prefix = 'RD' + dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return prefix + random;
  }

  private generateVerifyCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'VERIFY';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateCertificateContent(
    certificateNo: string,
    accident: any,
    parties: any[],
  ): string {
    const accidentTypeText = getAccidentTypeText(accident.accidentType);
    const occurTime = dayjs(accident.occurTime).format('YYYY年MM月DD日HH时mm分');

    let partiesText = '';
    parties.forEach((party, index) => {
      const liabilityText = {
        full: '全部责任',
        primary: '主要责任',
        secondary: '次要责任',
        none: '无责任',
      }[party.liability];

      partiesText += (index === 0 ? '甲' : '乙') + '方：' + party.name + '，驾驶' + party.plateNo + '号小型轿车，' + liabilityText + '\n';
    });

    return '道路交通事故认定书（简易程序）\n\n'
      + '第 ' + certificateNo + ' 号\n\n'
      + '事故时间：' + occurTime + '\n'
      + '事故地点：' + accident.location + '\n\n'
      + '当事人：\n' + partiesText + '\n'
      + '交通事故事实：\n' + occurTime + '，' + accident.description + '。\n\n'
      + '责任认定：\n' + accident.liabilityResult.liabilityDescription + '\n\n'
      + '损害赔偿调解结果：\n1. 双方车辆损失按责任比例承担；\n2. 此事故一次性解决，各方签字后生效。\n\n'
      + '当事人签字：__________  __________\n'
      + '办案民警：' + accident.liabilityResult.officer + '\n'
      + (accident.liabilityResult.determinedAt ? dayjs(accident.liabilityResult.determinedAt).format('YYYY年MM月DD日') : dayjs().format('YYYY年MM月DD日'));
  }
}
