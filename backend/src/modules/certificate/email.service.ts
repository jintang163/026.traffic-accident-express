import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { CertificateEntity } from './certificate.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      return null;
    }
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async sendCertificate(email: string, certificate: CertificateEntity, pdfBuffer?: Buffer): Promise<{ success: boolean; message: string; mockSent: boolean }> {
    const isAgreement = certificate.templateType === 'agreement';
    const subject = isAgreement ? '您的道路交通事故自行协商协议书' : '您的道路交通事故认定书';
    const title = isAgreement ? '道路交通事故自行协商协议书' : '道路交通事故认定书';
    const acc = (certificate.accident || {}) as any;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1f2937;max-width:640px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#1e5efa,#3b82f6);color:#fff;padding:28px 32px;border-radius:14px">
          <div style="font-size:20px;font-weight:700;margin-bottom:6px">${title}</div>
          <div style="font-size:13px;opacity:.9">编号：${certificate.certificateNo}</div>
        </div>
        <div style="background:#fff;border-radius:14px;padding:24px;margin-top:16px;box-shadow:0 4px 18px rgba(0,0,0,.06)">
          <div style="margin-bottom:12px"><b style="color:#6b7280">事故编号：</b><span>${acc.reportNo || '—'}</span></div>
          <div style="margin-bottom:12px"><b style="color:#6b7280">发生时间：</b><span>${acc.occurTime || '—'}</span></div>
          <div style="margin-bottom:12px"><b style="color:#6b7280">发生地点：</b><span>${acc.location || '—'}</span></div>
          <div style="margin-top:20px;padding:14px;background:#f9fafb;border-radius:10px;font-size:14px;line-height:1.7">
            <b>责任认定：</b>${acc.liabilityResult?.liabilityDescription || '—'}
          </div>
          <div style="margin-top:24px;padding:16px;background:#eff6ff;border-radius:10px;border-left:3px solid #1e5efa">
            请查看附件 PDF 获取完整认定书/协议书内容。您也可以扫描 PDF 内的二维码在线核验文件真伪。
          </div>
        </div>
        <div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af">本邮件由交通事故快速处理系统自动发送，请勿直接回复</div>
      </div>`;

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log('[Email Mock] 向 ' + email + ' 发送认定书邮件（SMTP未配置，仅记录日志）');
      return { success: true, message: '邮件已记录（SMTP未配置，以Mock方式发送）', mockSent: true };
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        html,
        attachments: pdfBuffer
          ? [{
              filename: certificate.certificateNo + '.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf',
            }]
          : undefined,
      });
      this.logger.log('认定书邮件已发送: ' + email);
      return { success: true, message: '邮件已发送', mockSent: false };
    } catch (e) {
      this.logger.error('邮件发送失败: ' + e.message);
      return { success: false, message: '邮件发送失败: ' + e.message, mockSent: false };
    }
  }
}
