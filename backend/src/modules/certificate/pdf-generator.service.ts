import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export type CertificateTemplateType = 'certificate' | 'agreement';

export interface CertificatePdfData {
  templateType?: CertificateTemplateType;
  certificateNo: string;
  accidentTime: string;
  location: string;
  accidentType: string;
  description: string;
  parties: Array<{
    name: string;
    plateNo: string;
    vehicleType: string;
    insuranceCompany: string;
    liability: string;
    phone: string;
  }>;
  liabilityConclusion: string;
  legalBasis: string;
  primaryLiability: number;
  secondaryLiability: number;
  officer: string;
  department: string;
  issuedAt: string;
  sealText: string;
  qrCodeBuffer?: Buffer;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly fontPath: string;
  private readonly fontBoldPath: string;

  constructor() {
    const fontsDir = path.join(process.cwd(), 'src', 'fonts');
    this.fontPath = path.join(fontsDir, 'SimHei.ttf');
    this.fontBoldPath = path.join(fontsDir, 'SimHei.ttf');
    if (!fs.existsSync(this.fontPath)) {
      this.logger.warn('中文字体文件不存在: ' + this.fontPath + '，将回退使用默认字体');
    }
  }

  private registerFonts(doc: PDFKit.PDFDocument): void {
    if (fs.existsSync(this.fontPath)) {
      doc.registerFont('Chinese', this.fontPath);
      doc.registerFont('Chinese-Bold', this.fontBoldPath);
      doc.font('Chinese');
    }
  }

  private setFont(doc: PDFKit.PDFDocument, size: number, bold = false): void {
    if (fs.existsSync(this.fontPath)) {
      doc.font(bold ? 'Chinese-Bold' : 'Chinese').fontSize(size);
    } else {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    }
  }

  resolveTemplateType(liabilityType?: string, accidentType?: string): CertificateTemplateType {
    if (liabilityType) {
      const t = String(liabilityType).toLowerCase();
      if (t.includes('negotiate') || t.includes('agreement') || t.includes('协商') || t.includes('自行')) {
        return 'agreement';
      }
    }
    if (accidentType) {
      const t = String(accidentType).toLowerCase();
      if (t.includes('negotiate') || t.includes('agreement') || t.includes('协商') || t.includes('自行')) {
        return 'agreement';
      }
    }
    return 'certificate';
  }

  async generateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
    const templateType = data.templateType || 'certificate';
    this.logger.log('开始生成认定书PDF: ' + data.certificateNo + ' 模板类型: ' + templateType);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const title = templateType === 'agreement' ? '道路交通事故自行协商协议书' : '道路交通事故认定书';

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 70, right: 70 },
        info: {
          Title: title,
          Author: '交通事故快速处理系统',
          Subject: data.certificateNo,
          Creator: 'Traffic Accident Express System',
        },
      });

      this.registerFonts(doc);

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        this.logger.log('PDF生成完成，大小: ' + buffer.length + ' bytes');
        resolve(buffer);
      });
      doc.on('error', reject);

      if (templateType === 'agreement') {
        this.renderAgreementTemplate(doc, data);
      } else {
        this.renderCertificateTemplate(doc, data);
      }

      doc.end();
    });
  }

  // ===================== 认定书模板 =====================
  private renderCertificateTemplate(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    this.renderHeader(doc, data, '道路交通事故认定书', '（简易程序）');
    this.renderAccidentInfo(doc, data);
    this.renderParties(doc, data);
    this.renderFacts(doc, data, '三、交通事故事实');
    this.renderLiability(doc, data, '四、责任认定');
    this.renderSettlement(doc, data, '五、损害赔偿调解结果');
    this.renderSignatureBlock(doc, data);
    this.renderSealAndQr(doc, data);
    this.renderFooter(doc, data);
  }

  // ===================== 自行协商协议书模板 =====================
  private renderAgreementTemplate(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    this.renderHeader(doc, data, '道路交通事故自行协商协议书', '（当事人自行协商版）');

    this.setFont(doc, 10);
    doc.text('根据《中华人民共和国道路交通安全法》及《道路交通事故处理程序规定》，甲乙双方就本次交通事故', {
      align: 'justify', lineGap: 3,
    });
    doc.text('在自愿、平等的基础上自行协商，达成如下协议：', {
      align: 'justify', lineGap: 3,
    });
    doc.moveDown(0.8);

    this.renderAccidentInfo(doc, data, '一、事故基本情况');
    this.renderParties(doc, data, '二、当事人信息');
    this.renderFacts(doc, data, '三、事故事实及双方确认');

    this.setFont(doc, 13, true);
    doc.text('四、责任划分');
    doc.moveDown(0.3);
    this.setFont(doc, 10);
    doc.text('双方共同确认本次事故责任划分如下：', { lineGap: 3 });
    doc.moveDown(0.2);
    doc.text(data.liabilityConclusion, { align: 'justify', lineGap: 3 });
    doc.moveDown(0.2);
    doc.text('责任比例：甲方 ' + data.primaryLiability + '%，乙方 ' + data.secondaryLiability + '%');
    doc.moveDown(0.8);

    this.setFont(doc, 13, true);
    doc.text('五、损害赔偿协议');
    doc.moveDown(0.3);
    this.setFont(doc, 10);
    const damages = [
      '1. 双方车辆损失按上述责任比例各自承担，各自向所投保的保险公司进行理赔；',
      '2. 因本次事故造成的人员伤亡（如有）医疗费用、误工费用等按责任比例承担；',
      '3. 本协议为双方一次性解决协议，各方签字并按指印后即具法律效力；',
      '4. 双方承诺不存在逃逸、酒驾、毒驾、故意伪造现场等违法行为，如有愿承担一切法律后果；',
      '5. 双方对本协议内容已充分阅读并完全理解，不存在任何欺诈、胁迫或重大误解情形。',
    ];
    damages.forEach((line) => {
      doc.text(line, { lineGap: 3 });
    });
    doc.moveDown(0.8);

    this.setFont(doc, 13, true);
    doc.text('六、其他约定');
    doc.moveDown(0.3);
    this.setFont(doc, 10);
    doc.text('1. 本协议书一式三份，甲乙双方各执一份，平台留存一份，具有同等法律效力；');
    doc.text('2. 本协议书自双方签字（电子签名）后生效；');
    doc.text('3. 因本协议产生争议，双方应友好协商解决，协商不成可向事故发生地人民法院提起诉讼。');
    doc.moveDown(1);

    this.renderSignatureBlock(doc, data, true);
    this.renderSealAndQr(doc, data);
    this.renderFooter(doc, data, true);
  }

  // ===================== 公共渲染方法 =====================
  private renderHeader(doc: PDFKit.PDFDocument, data: CertificatePdfData, title: string, subTitle: string): void {
    this.setFont(doc, 22, true);
    doc.text(title, { align: 'center' });
    doc.moveDown(0.3);

    this.setFont(doc, 9);
    doc.text(subTitle, { align: 'center' });
    doc.moveDown(0.5);

    doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor('#C41E3A').lineWidth(2).stroke();
    doc.moveDown(0.5);

    this.setFont(doc, 11, true);
    doc.text('第 ' + data.certificateNo + ' 号', { align: 'center' });
    doc.moveDown(1);
  }

  private renderAccidentInfo(doc: PDFKit.PDFDocument, data: CertificatePdfData, title: string = '一、事故基本情况'): void {
    this.setFont(doc, 13, true);
    doc.text(title);
    doc.moveDown(0.3);

    this.setFont(doc, 10.5);
    const infoY = doc.y;
    doc.text('事故时间：' + data.accidentTime, 70, infoY);
    doc.text('事故地点：' + data.location, 70, infoY + 18);
    doc.text('事故类型：' + data.accidentType, 70, infoY + 36);
    doc.y = infoY + 56;
    doc.moveDown(0.5);
  }

  private renderParties(doc: PDFKit.PDFDocument, data: CertificatePdfData, title: string = '二、当事人信息'): void {
    this.setFont(doc, 13, true);
    doc.text(title);
    doc.moveDown(0.3);

    data.parties.forEach((party, index) => {
      const label = index === 0 ? '甲' : '乙';
      this.setFont(doc, 10.5, true);
      doc.text(label + '方：');
      this.setFont(doc, 10);

      const startY = doc.y;
      doc.text('姓名：' + party.name, 90, startY);
      doc.text('车牌号：' + party.plateNo, 300, startY);
      doc.text('车辆类型：' + party.vehicleType, 90, startY + 16);
      doc.text('保险公司：' + (party.insuranceCompany || '未提供'), 300, startY + 16);
      doc.text('联系电话：' + party.phone, 90, startY + 32);
      doc.text('责任：' + party.liability, 300, startY + 32);

      doc.y = startY + 52;
    });
    doc.moveDown(0.5);
  }

  private renderFacts(doc: PDFKit.PDFDocument, data: CertificatePdfData, title: string): void {
    this.setFont(doc, 13, true);
    doc.text(title);
    doc.moveDown(0.3);

    this.setFont(doc, 10);
    doc.text(data.description || data.accidentTime + '，' + data.location + '发生' + data.accidentType + '。', {
      align: 'justify',
      lineGap: 4,
    });
    doc.moveDown(0.8);
  }

  private renderLiability(doc: PDFKit.PDFDocument, data: CertificatePdfData, title: string): void {
    this.setFont(doc, 13, true);
    doc.text(title);
    doc.moveDown(0.3);

    this.setFont(doc, 10);
    doc.text(data.liabilityConclusion, {
      align: 'justify',
      lineGap: 4,
    });
    doc.moveDown(0.3);

    if (data.legalBasis) {
      this.setFont(doc, 9.5);
      doc.text('法律依据：' + data.legalBasis, {
        align: 'justify',
        lineGap: 3,
      });
    }
    doc.moveDown(0.3);

    this.setFont(doc, 10);
    doc.text('责任比例：甲方 ' + data.primaryLiability + '%，乙方 ' + data.secondaryLiability + '%');
    doc.moveDown(0.8);
  }

  private renderSettlement(doc: PDFKit.PDFDocument, data: CertificatePdfData, title: string): void {
    this.setFont(doc, 13, true);
    doc.text(title);
    doc.moveDown(0.3);

    this.setFont(doc, 10);
    doc.text('1. 双方车辆损失按责任比例承担；', { lineGap: 3 });
    doc.text('2. 此事故一次性解决，各方签字后生效。', { lineGap: 3 });
    doc.moveDown(0.8);
  }

  private renderSignatureBlock(doc: PDFKit.PDFDocument, data: CertificatePdfData, isAgreement = false): void {
    this.setFont(doc, 13, true);
    doc.text(isAgreement ? '七、双方签名确认' : '六、签名');
    doc.moveDown(0.5);

    const signY = doc.y;
    this.setFont(doc, 10);
    doc.text('甲方签字：________________', 70, signY);
    doc.text('乙方签字：________________', 300, signY);
    if (isAgreement) {
      doc.text('甲方按指印：______________', 70, signY + 22);
      doc.text('乙方按指印：______________', 300, signY + 22);
    }
    doc.moveDown(1.5);

    if (!isAgreement) {
      doc.text('办案民警：' + data.officer, 70, doc.y);
      doc.moveDown(0.8);
    }
  }

  private renderSealAndQr(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    const sealX = 350;
    const sealY = doc.y;

    doc.save();
    doc.translate(sealX + 50, sealY + 50);
    doc.rotate(15);
    doc.circle(0, 0, 45).strokeColor('#C41E3A').lineWidth(2.5).stroke();
    doc.circle(0, 0, 40).strokeColor('#C41E3A').lineWidth(0.5).stroke();
    this.setFont(doc, 8, true);
    doc.fillColor('#C41E3A');
    const sealLines = this.wrapSealText(data.sealText, 4);
    sealLines.forEach((line, i) => {
      const offsetY = -((sealLines.length - 1) * 7) / 2 + i * 7;
      doc.text(line, -25, offsetY - 3, { width: 50, align: 'center' });
    });
    this.setFont(doc, 7);
    doc.text('★', -4, 12, { align: 'center' });
    doc.restore();
    doc.fillColor('#000000');

    if (data.qrCodeBuffer) {
      try {
        doc.image(data.qrCodeBuffer, 70, sealY - 10, { width: 80, height: 80 });
        this.setFont(doc, 8);
        doc.text('扫描二维码核验真伪', 70, sealY + 72, { width: 80, align: 'center' });
      } catch (e) {
        this.logger.warn('QR码嵌入PDF失败: ' + e.message);
      }
    }

    doc.y = sealY + 100;

    this.setFont(doc, 10);
    doc.text(data.department, 70, doc.y);
    doc.moveDown(0.3);
    doc.text(data.issuedAt, 70, doc.y);
    doc.moveDown(1);
  }

  private renderFooter(doc: PDFKit.PDFDocument, data: CertificatePdfData, isAgreement = false): void {
    doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor('#999999').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    this.setFont(doc, 8);
    doc.fillColor('#666666');
    doc.text(isAgreement ? '本协议书电子形式与纸质形式具有同等法律效力' : '本认定书与纸质认定书具有同等法律效力', { align: 'center' });
    doc.text(isAgreement ? '本协议经双方签字后生效，不得反悔' : '当事人对认定有异议的，可在送达之日起三日内申请复核', { align: 'center' });
    doc.text('本文件可通过核验码或扫描二维码进行核验真伪', { align: 'center' });
    doc.fillColor('#000000');
  }

  private wrapSealText(text: string, maxCharsPerLine: number): string[] {
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
      lines.push(text.substring(i, i + maxCharsPerLine));
    }
    return lines;
  }

  async generateCertificatePdfToFile(data: CertificatePdfData, filePath: string): Promise<string> {
    const buffer = await this.generateCertificatePdf(data);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
}
