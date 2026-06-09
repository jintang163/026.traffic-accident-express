import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { CertificateEntity, CertificateStatus } from './certificate.entity';
import { AccidentService } from '../accident/accident.service';
import { getAccidentTypeText } from '../../utils/validator';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(CertificateEntity)
    private certificateRepository: Repository<CertificateEntity>,
    private accidentService: AccidentService,
  ) {}

  async generate(accidentId: string, userId?: string): Promise<CertificateEntity> {
    console.log('[CertificateService] 生成认定书:', accidentId);
    
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
        name: vehicle.ownerName || `当事人${index + 1}`,
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
    console.log('[CertificateService] 认定书生成成功:', saved.id);
    
    return saved;
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
      throw new NotFoundException(`认定书 ${id} 不存在`);
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

  async share(id: string): Promise<{ shareUrl: string; verifyCode: string }> {
    const certificate = await this.findOne(id);
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/certificate/verify?no=${certificate.certificateNo}&code=${certificate.verifyCode}`;
    
    return {
      shareUrl,
      verifyCode: certificate.verifyCode,
    };
  }

  async download(id: string): Promise<{ url: string }> {
    const certificate = await this.findOne(id);
    
    if (!certificate.pdfUrl) {
      certificate.pdfUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/certificates/${certificate.id}.pdf`;
      await this.certificateRepository.save(certificate);
    }
    
    return { url: certificate.pdfUrl };
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
    
    console.log('[CertificateService] 发送认定书到手机:', phone, '认定书号:', certificate.certificateNo);
    
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
      
      partiesText += `${index === 0 ? '甲' : '乙'}方：${party.name}，驾驶${party.plateNo}号${parties[index]?.liability === 'full' ? '小型轿车' : '小型轿车'}，${liabilityText}\n`;
    });
    
    return `道路交通事故认定书（简易程序）

第 ${certificateNo} 号

事故时间：${occurTime}
事故地点：${accident.location}

当事人：
${partiesText}

交通事故事实：
${occurTime}，${accident.description}。

责任认定：
${accident.liabilityResult.liabilityDescription}

损害赔偿调解结果：
1. 双方车辆损失按责任比例承担；
2. 此事故一次性解决，各方签字后生效。

当事人签字：__________  __________
办案民警：${accident.liabilityResult.officer}
${accident.liabilityResult.determinedAt ? dayjs(accident.liabilityResult.determinedAt).format('YYYY年MM月DD日') : dayjs().format('YYYY年MM月DD日')}`;
  }
}
