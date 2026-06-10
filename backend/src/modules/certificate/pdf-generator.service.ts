import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface CertificatePdfData {
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

  async generateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
    this.logger.log('开始生成认定书PDF: ' + data.certificateNo);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 70, right: 70 },
        info: {
          Title: '道路交通事故认定书',
          Author: '交通事故快速处理系统',
          Subject: data.certificateNo,
          Creator: 'Traffic Accident Express System',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        this.logger.log('PDF生成完成，大小: ' + buffer.length + ' bytes');
        resolve(buffer);
      });
      doc.on('error', reject);

      this.renderDocument(doc, data);

      doc.end();
    });
  }

  private renderDocument(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    this.renderHeader(doc, data);
    this.renderAccidentInfo(doc, data);
    this.renderParties(doc, data);
    this.renderFacts(doc, data);
    this.renderLiability(doc, data);
    this.renderSettlement(doc, data);
    this.renderSignature(doc, data);
    this.renderSealAndQr(doc, data);
    this.renderFooter(doc, data);
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(22).font('Helvetica-Bold');
    doc.text('道路交通事故认定书', { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(9).font('Helvetica');
    doc.text('（简易程序）', { align: 'center' });
    doc.moveDown(0.5);

    doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor('#C41E3A').lineWidth(2).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('第 ' + data.certificateNo + ' 号', { align: 'center' });
    doc.moveDown(1);
  }

  private renderAccidentInfo(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('一、事故基本情况', { underline: false });
    doc.moveDown(0.3);

    doc.fontSize(10.5).font('Helvetica');
    const infoY = doc.y;
    doc.text('事故时间：' + data.accidentTime, 70, infoY);
    doc.text('事故地点：' + data.location, 70, infoY + 18);
    doc.text('事故类型：' + data.accidentType, 70, infoY + 36);
    doc.moveDown(2.5);
  }

  private renderParties(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('二、当事人信息');
    doc.moveDown(0.3);

    data.parties.forEach((party, index) => {
      const label = index === 0 ? '甲' : '乙';
      doc.fontSize(10.5).font('Helvetica-Bold');
      doc.text(label + '方：');
      doc.fontSize(10).font('Helvetica');

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

  private renderFacts(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('三、交通事故事实');
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica');
    doc.text(data.description || data.accidentTime + '，' + data.location + '发生' + data.accidentType + '。', {
      align: 'justify',
      lineGap: 4,
    });
    doc.moveDown(0.8);
  }

  private renderLiability(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('四、责任认定');
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica');
    doc.text(data.liabilityConclusion, {
      align: 'justify',
      lineGap: 4,
    });
    doc.moveDown(0.3);

    if (data.legalBasis) {
      doc.fontSize(9.5).font('Helvetica');
      doc.text('法律依据：' + data.legalBasis, {
        align: 'justify',
        lineGap: 3,
      });
    }
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica');
    doc.text('责任比例：甲方 ' + data.primaryLiability + '%，乙方 ' + data.secondaryLiability + '%');
    doc.moveDown(0.8);
  }

  private renderSettlement(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('五、损害赔偿调解结果');
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica');
    doc.text('1. 双方车辆损失按责任比例承担；', { lineGap: 3 });
    doc.text('2. 此事故一次性解决，各方签字后生效。', { lineGap: 3 });
    doc.moveDown(0.8);
  }

  private renderSignature(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('六、签名');
    doc.moveDown(0.5);

    const signY = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text('甲方签字：________________', 70, signY);
    doc.text('乙方签字：________________', 300, signY);
    doc.moveDown(1);

    doc.text('办案民警：' + data.officer, 70, doc.y);
    doc.moveDown(0.8);
  }

  private renderSealAndQr(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    const sealX = 350;
    const sealY = doc.y;

    doc.save();
    doc.translate(sealX + 50, sealY + 50);
    doc.rotate(15);
    doc.circle(0, 0, 45).strokeColor('#C41E3A').lineWidth(2.5).stroke();
    doc.circle(0, 0, 40).strokeColor('#C41E3A').lineWidth(0.5).stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#C41E3A');
    const sealLines = this.wrapSealText(data.sealText, 5);
    sealLines.forEach((line, i) => {
      const offsetY = -((sealLines.length - 1) * 7) / 2 + i * 7;
      doc.text(line, -25, offsetY - 3, { width: 50, align: 'center' });
    });
    doc.fontSize(7).text('★', -4, 12, { align: 'center' });
    doc.restore();
    doc.fillColor('#000000');

    if (data.qrCodeBuffer) {
      try {
        doc.image(data.qrCodeBuffer, 70, sealY - 10, { width: 80, height: 80 });
        doc.fontSize(8).font('Helvetica');
        doc.text('扫描二维码核验真伪', 70, sealY + 72, { width: 80, align: 'center' });
      } catch (e) {
        this.logger.warn('QR码嵌入PDF失败: ' + e.message);
      }
    }

    doc.y = sealY + 100;

    doc.fontSize(10).font('Helvetica');
    doc.text(data.department, 70, doc.y);
    doc.moveDown(0.3);
    doc.text(data.issuedAt, 70, doc.y);
    doc.moveDown(1);
  }

  private renderFooter(doc: PDFKit.PDFDocument, data: CertificatePdfData): void {
    doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor('#999999').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text('本认定书与纸质认定书具有同等法律效力', { align: 'center' });
    doc.text('当事人对认定有异议的，可在送达之日起三日内申请复核', { align: 'center' });
    doc.text('本认定书可通过核验码或扫描二维码进行核验真伪', { align: 'center' });
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
