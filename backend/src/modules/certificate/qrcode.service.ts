import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  async generateQrCodeBuffer(
    data: string,
    options: QrCodeOptions = {},
  ): Promise<Buffer> {
    const {
      width = 200,
      margin = 2,
      color = { dark: '#000000', light: '#FFFFFF' },
    } = options;

    this.logger.log('生成二维码: ' + data.substring(0, 50) + '...');

    try {
      const buffer = await QRCode.toBuffer(data, {
        width,
        margin,
        color,
        type: 'png',
        errorCorrectionLevel: 'M',
      });

      this.logger.log('二维码生成成功，大小: ' + buffer.length + ' bytes');
      return buffer;
    } catch (error) {
      this.logger.error('二维码生成失败: ' + error.message);
      throw error;
    }
  }

  async generateQrCodeBase64(
    data: string,
    options: QrCodeOptions = {},
  ): Promise<string> {
    const {
      width = 200,
      margin = 2,
      color = { dark: '#000000', light: '#FFFFFF' },
    } = options;

    this.logger.log('生成Base64二维码: ' + data.substring(0, 50) + '...');

    try {
      const base64 = await QRCode.toDataURL(data, {
        width,
        margin,
        color,
        errorCorrectionLevel: 'M',
      });

      return base64;
    } catch (error) {
      this.logger.error('Base64二维码生成失败: ' + error.message);
      throw error;
    }
  }

  async generateVerificationQrCode(
    certificateNo: string,
    verifyCode: string,
    baseUrl?: string,
  ): Promise<Buffer> {
    const url = (baseUrl || process.env.BASE_URL || 'http://localhost:3000')
      + '/api/certificate/verify?no=' + certificateNo
      + '&code=' + verifyCode;

    return this.generateQrCodeBuffer(url, {
      width: 180,
      margin: 1,
    });
  }

  async generateVerificationQrCodeBase64(
    certificateNo: string,
    verifyCode: string,
    baseUrl?: string,
  ): Promise<string> {
    const url = (baseUrl || process.env.BASE_URL || 'http://localhost:3000')
      + '/api/certificate/verify?no=' + certificateNo
      + '&code=' + verifyCode;

    return this.generateQrCodeBase64(url, {
      width: 180,
      margin: 1,
    });
  }
}
