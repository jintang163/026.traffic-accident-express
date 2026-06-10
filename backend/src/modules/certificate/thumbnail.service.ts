import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as sharp from 'sharp';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { CertificateEntity } from './certificate.entity';
import { getAccidentTypeText } from '../../utils/validator';
import * as dayjs from 'dayjs';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly fontPath = path.resolve(__dirname, '../../../fonts/SimHei.ttf');
  private readonly fontBoldPath = path.resolve(__dirname, '../../../fonts/SimHei.ttf');

  private setFont(doc: PDFKit.PDFDocument, size: number = 12, bold: boolean = false): void {
    const fontName = fs.existsSync(this.fontPath) ? (bold ? 'Chinese-Bold' : 'Chinese') : 'Helvetica';
    doc.font(fontName, size);
  }

  async generateThumbnail(certificate: CertificateEntity): Promise<Buffer> {
    this.logger.log('生成认定书缩略图: ' + certificate.id);

    const width = 600;
    const height = 900;

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: [width, height], margin: 30 });
        if (fs.existsSync(this.fontPath)) {
          doc.registerFont('Chinese', this.fontPath);
          doc.registerFont('Chinese-Bold', this.fontBoldPath);
        }

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', async () => {
          const pdfBuf = Buffer.concat(chunks);
          try {
            const png = await sharp(pdfBuf, { density: 150 })
              .png()
              .resize(width, height)
              .toBuffer();
            resolve(png);
          } catch (e) {
            resolve(pdfBuf);
          }
        });
        doc.on('error', reject);

        const isAgreement = certificate.templateType === 'agreement';
        const title = isAgreement ? '道路交通事故自行协商协议书' : '道路交通事故认定书';
        const acc = (certificate.accident || {}) as any;

        doc.rect(0, 0, width, 110).fill('#1e5efa');
        this.setFont(doc, 22, true);
        doc.fillColor('#ffffff').text(title, 30, 35, { width: width - 60, align: 'center' });
        this.setFont(doc, 11);
        doc.fillColor('#e0ecff').text('编号：' + certificate.certificateNo, 30, 70, { width: width - 60, align: 'center' });

        let y = 140;

        this.setFont(doc, 14, true);
        doc.fillColor('#1e5efa').text('事故信息', 40, y);
        y += 22;
        this.setFont(doc, 11);
        doc.fillColor('#6b7280');
        const infos = [
          ['事故编号', acc.reportNo || '—'],
          ['事故类型', getAccidentTypeText(acc.accidentType) || '—'],
          ['发生时间', acc.occurTime ? dayjs(acc.occurTime).format('YYYY-MM-DD HH:mm') : '—'],
          ['发生地点', acc.location || '—'],
        ];
        for (const [k, v] of infos) {
          doc.fillColor('#6b7280').text(k + '：', 40, y, { continued: true, width: 120 });
          doc.fillColor('#111827').text(String(v));
          y += 20;
        }

        y += 10;
        this.setFont(doc, 14, true);
        doc.fillColor('#1e5efa').text('当事人信息', 40, y);
        y += 22;
        (certificate.parties || []).slice(0, 2).forEach((p, i) => {
          const label = i === 0 ? '甲方' : '乙方';
          const liabMap: Record<string, string> = { full: '全部责任', primary: '主要责任', secondary: '次要责任', none: '无责任' };
          this.setFont(doc, 11, true);
          doc.fillColor('#1d4ed8').text(label + '  ' + p.name + '  ' + p.plateNo, 40, y);
          y += 18;
          this.setFont(doc, 10);
          doc.fillColor('#6b7280').text('责任：' + (liabMap[p.liability] || '—'), 50, y);
          y += 18;
        });

        y += 10;
        this.setFont(doc, 14, true);
        doc.fillColor('#1e5efa').text('责任认定', 40, y);
        y += 22;
        this.setFont(doc, 10);
        doc.fillColor('#374151');
        const desc = acc.liabilityResult?.liabilityDescription || '—';
        doc.text(desc, 40, y, { width: width - 80, height: 80 });
        y += 90;

        const footerY = height - 180;
        this.setFont(doc, 14, true);
        doc.fillColor('#1e5efa').text('签发信息', 40, footerY);
        this.setFont(doc, 10);
        doc.fillColor('#6b7280').text('出具单位：' + (certificate.issuedBy || '—'), 40, footerY + 22);
        doc.fillColor('#6b7280').text('出具时间：' + (certificate.issuedAt ? dayjs(certificate.issuedAt).format('YYYY-MM-DD') : '—'), 40, footerY + 40);
        doc.fillColor('#6b7280').text('核验码：' + certificate.verifyCode, 40, footerY + 58);

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async generateShareImage(certificate: CertificateEntity): Promise<Buffer> {
    return this.generateThumbnail(certificate);
  }
}
