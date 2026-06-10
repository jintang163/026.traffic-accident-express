import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { CertificateEntity, CertificateStatus, CertificateTemplateType } from './certificate.entity';
import { AccidentService } from '../accident/accident.service';
import { getAccidentTypeText } from '../../utils/validator';
import { PdfGeneratorService, CertificatePdfData } from './pdf-generator.service';
import { ElectronicSignatureService } from './electronic-signature.service';
import { QrCodeService } from './qrcode.service';
import { CloudStorageService } from '../evidence/cloud-storage.service';
import { ThumbnailService } from './thumbnail.service';
import { EmailService } from './email.service';

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
    private thumbnailService: ThumbnailService,
    private emailService: EmailService,
  ) {}

  private getApiBaseUrl(): string {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    if (!base.endsWith('/api') && !base.includes('/api/')) {
      return base.endsWith('/') ? base + 'api' : base + '/api';
    }
    return base;
  }

  private getWebBaseUrl(): string {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    if (base.endsWith('/api')) {
      return base.substring(0, base.length - 4);
    }
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }

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

    const templateType = this.pdfGeneratorService.resolveTemplateType(
      accident.liabilityResult.liabilityType,
      accident.accidentType,
    );

    const certificateNo = this.generateCertificateNo(templateType);
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
      templateType,
    );

    const certificate = this.certificateRepository.create({
      certificateNo,
      templateType,
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
    this.logger.log('认定书生成成功: ' + saved.id + ' 模板类型: ' + templateType);

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
    const apiBaseUrl = this.getApiBaseUrl();

    const qrCodeBuffer = await this.qrCodeService.generateVerificationQrCode(
      certificate.certificateNo,
      certificate.verifyCode,
      apiBaseUrl,
    );

    const liabilityTextMap: Record<string, string> = {
      full: '全部责任',
      primary: '主要责任',
      secondary: '次要责任',
      none: '无责任',
    };

    const pdfData: CertificatePdfData = {
      templateType: certificate.templateType as CertificateTemplateType || 'certificate',
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
      sealType: certificate.templateType === 'agreement' ? 'platform' : 'police',
    });

    if (signResult.success && signResult.signedPdfBuffer) {
      pdfBuffer = signResult.signedPdfBuffer;
    }

    const folder = certificate.templateType === 'agreement' ? 'agreements' : 'certificates';
    const fileName = certificate.certificateNo + '.pdf';
    const uploadResult = await this.cloudStorageService.uploadBuffer(pdfBuffer, fileName, {
      folder: folder + '/' + dayjs().format('YYYY/MM/DD'),
    });

    let qrCodeUrl: string | null = null;
    try {
      const qrCodeBase64 = await this.qrCodeService.generateVerificationQrCodeBase64(
        certificate.certificateNo,
        certificate.verifyCode,
        apiBaseUrl,
      );
      const qrCodeImageBuffer = Buffer.from(qrCodeBase64.split(',')[1], 'base64');
      const qrUploadResult = await this.cloudStorageService.uploadBuffer(
        qrCodeImageBuffer,
        certificate.certificateNo + '_qrcode.png',
        { folder: folder + '/qrcode' },
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

    this.generateThumbnail(updated.id).catch((err) => {
      this.logger.warn('缩略图异步生成失败: ' + err.message);
    });

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
    templateType?: string;
    userId?: string;
  }): Promise<{ list: CertificateEntity[]; total: number }> {
    const { page = 1, pageSize = 10, status, templateType, userId } = params || {};

    const queryBuilder = this.certificateRepository
      .createQueryBuilder('certificate')
      .leftJoinAndSelect('certificate.accident', 'accident')
      .orderBy('certificate.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('certificate.status = :status', { status });
    }

    if (templateType) {
      queryBuilder.andWhere('certificate.templateType = :templateType', { templateType });
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

  async findByCertificateNo(certificateNo: string): Promise<CertificateEntity | null> {
    return await this.certificateRepository.findOne({
      where: { certificateNo },
      relations: ['accident'],
    });
  }

  async verify(certificateNo: string, verifyCode: string): Promise<{
    valid: boolean;
    certificate?: CertificateEntity;
    message?: string;
  }> {
    const certificate = await this.certificateRepository.findOne({
      where: { certificateNo, verifyCode },
      relations: ['accident'],
    });

    if (!certificate) {
      return { valid: false, message: '认定书号或核验码不正确' };
    }

    if (certificate.status === 'revoked') {
      return { valid: false, certificate, message: '该认定书已被撤销' };
    }

    if (new Date() > certificate.validUntil) {
      return { valid: false, certificate, message: '该认定书已超过有效期' };
    }

    return { valid: true, certificate, message: '核验通过' };
  }

  async share(id: string): Promise<{
    shareUrl: string;
    verifyCode: string;
    qrCodeUrl?: string;
    thumbnailUrl?: string;
    templateType?: string;
    certificateNo?: string;
    title?: string;
    description?: string;
  }> {
    const certificate = await this.findOne(id);

    const webBaseUrl = this.getWebBaseUrl();
    const shareUrl = webBaseUrl + '/verify?no=' + certificate.certificateNo + '&code=' + certificate.verifyCode;

    const isAgreement = certificate.templateType === 'agreement';
    const title = isAgreement ? '道路交通事故自行协商协议书' : '道路交通事故认定书';
    const acc = (certificate.accident || {}) as any;
    const description =
      (acc.occurTime ? dayjs(acc.occurTime).format('YYYY-MM-DD') + ' ' : '') +
      (acc.location || '') + ' · ' +
      (acc.liabilityResult?.liabilityDescription || '已出具认定结果');

    return {
      shareUrl,
      verifyCode: certificate.verifyCode,
      qrCodeUrl: certificate.qrCodeUrl,
      thumbnailUrl: certificate.thumbnailUrl,
      templateType: certificate.templateType,
      certificateNo: certificate.certificateNo,
      title,
      description,
    };
  }

  async generateThumbnail(id: string): Promise<CertificateEntity> {
    const certificate = await this.findOne(id);
    try {
      const buf = await this.thumbnailService.generateThumbnail(certificate);
      const key = (certificate.templateType === 'agreement' ? 'agreements' : 'certificates') + '/' + certificate.certificateNo + '_thumbnail.png';
      const result = await this.cloudStorageService.uploadBuffer(buf, key, 'image/png');
      certificate.thumbnailUrl = result.url;
      return await this.certificateRepository.save(certificate);
    } catch (e) {
      this.logger.error('缩略图生成失败: ' + e.message);
      return certificate;
    }
  }

  async getThumbnail(id: string): Promise<{ url: string }> {
    let certificate = await this.findOne(id);
    if (!certificate.thumbnailUrl) {
      certificate = await this.generateThumbnail(id);
    }
    return { url: certificate.thumbnailUrl };
  }

  async sendEmail(id: string, email: string): Promise<{ success: boolean; message: string; mockSent: boolean }> {
    const certificate = await this.findOne(id);
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.getPdfBuffer(id);
    } catch (e) {
      this.logger.warn('发送邮件时PDF获取失败，将不附带附件: ' + e.message);
    }
    return this.emailService.sendCertificate(email, certificate, pdfBuffer);
  }

  async download(id: string): Promise<{ url: string; qrCodeUrl?: string; templateType?: string }> {
    const certificate = await this.findOne(id);

    if (!certificate.pdfUrl) {
      const updated = await this.generateAndUploadPdf(id);
      return {
        url: updated.pdfUrl,
        qrCodeUrl: updated.qrCodeUrl,
        templateType: updated.templateType,
      };
    }

    return {
      url: certificate.pdfUrl,
      qrCodeUrl: certificate.qrCodeUrl,
      templateType: certificate.templateType,
    };
  }

  async getStatistics(userId?: string): Promise<{
    total: number; issued: number; verified: number; revoked: number;
    certificates: number; agreements: number;
  }> {
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

    const certificates = await this.certificateRepository.count({
      where: { templateType: 'certificate', ...(userId ? { createdBy: userId } : {}) },
    });

    const agreements = await this.certificateRepository.count({
      where: { templateType: 'agreement', ...(userId ? { createdBy: userId } : {}) },
    });

    return { total, issued, verified, revoked, certificates, agreements };
  }

  async send(id: string, phone: string): Promise<{ success: boolean }> {
    const certificate = await this.findOne(id);

    this.logger.log('发送认定书到手机: ' + phone + ' 认定书号: ' + certificate.certificateNo);

    return { success: true };
  }

  private generateCertificateNo(templateType: CertificateTemplateType = 'certificate'): string {
    const prefix = templateType === 'agreement'
      ? 'XSSQ' + dayjs().format('YYYYMMDD')
      : 'RD' + dayjs().format('YYYYMMDD');
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
    templateType: CertificateTemplateType,
  ): string {
    const accidentTypeText = getAccidentTypeText(accident.accidentType);
    const occurTime = dayjs(accident.occurTime).format('YYYY年MM月DD日HH时mm分');
    const title = templateType === 'agreement'
      ? '道路交通事故自行协商协议书（当事人自行协商版）'
      : '道路交通事故认定书（简易程序）';

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

    if (templateType === 'agreement') {
      return title + '\n\n'
        + '第 ' + certificateNo + ' 号\n\n'
        + '根据《中华人民共和国道路交通安全法》及《道路交通事故处理程序规定》，甲乙双方就本次交通事故在自愿、平等的基础上自行协商，达成如下协议：\n\n'
        + '一、事故基本情况\n'
        + '事故时间：' + occurTime + '\n'
        + '事故地点：' + accident.location + '\n'
        + '事故类型：' + accidentTypeText + '\n\n'
        + '二、当事人信息：\n' + partiesText + '\n'
        + '三、事故事实及双方确认：\n' + occurTime + '，' + accident.description + '。\n\n'
        + '四、责任划分：\n' + accident.liabilityResult.liabilityDescription + '\n\n'
        + '五、损害赔偿协议：\n1. 双方车辆损失按责任比例承担；\n2. 本协议一次性解决，各方签字后生效。\n\n'
        + '六、其他约定：本协议书一式三份，甲乙双方各执一份，平台留存一份，具有同等法律效力。\n\n'
        + '双方签名：__________  __________\n'
        + '签订日期：' + (accident.liabilityResult.determinedAt ? dayjs(accident.liabilityResult.determinedAt).format('YYYY年MM月DD日') : dayjs().format('YYYY年MM月DD日'));
    }

    return title + '\n\n'
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
