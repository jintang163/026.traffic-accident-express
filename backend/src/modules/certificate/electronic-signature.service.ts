import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

export interface SignatureRequest {
  certificateNo: string;
  pdfBuffer: Buffer;
  sealType: 'police' | 'platform';
  signerInfo?: {
    name: string;
    idCardNo?: string;
  };
}

export interface SignatureResult {
  success: boolean;
  signedPdfBuffer?: Buffer;
  signatureInfo: {
    provider: string;
    sealType: string;
    sealSn: string;
    signedAt: string;
    certificateSn: string;
    isValid: boolean;
  };
  error?: string;
}

export type SignatureProvider = 'cfca' | 'fadada' | 'mock';

@Injectable()
export class ElectronicSignatureService {
  private readonly logger = new Logger(ElectronicSignatureService.name);

  private getProvider(): SignatureProvider {
    if (process.env.ESIGN_CFCA_API_URL && process.env.ESIGN_CFCA_API_KEY) return 'cfca';
    if (process.env.ESIGN_FADADA_API_URL && process.env.ESIGN_FADADA_API_KEY) return 'fadada';
    return 'mock';
  }

  async signPdf(request: SignatureRequest): Promise<SignatureResult> {
    const provider = this.getProvider();
    this.logger.log('电子签章请求: ' + request.certificateNo + ', 签章类型: ' + request.sealType + ', 服务商: ' + provider);

    try {
      switch (provider) {
        case 'cfca':
          return await this.signWithCfca(request);
        case 'fadada':
          return await this.signWithFadada(request);
        default:
          return await this.signWithMock(request);
      }
    } catch (error) {
      this.logger.error('电子签章失败: ' + error.message);
      return {
        success: false,
        signatureInfo: {
          provider: provider,
          sealType: request.sealType,
          sealSn: '',
          signedAt: new Date().toISOString(),
          certificateSn: '',
          isValid: false,
        },
        error: error.message,
      };
    }
  }

  async verifySignature(pdfBuffer: Buffer, certificateNo: string): Promise<{ valid: boolean; details?: any }> {
    const provider = this.getProvider();

    try {
      switch (provider) {
        case 'cfca':
          return await this.verifyWithCfca(pdfBuffer, certificateNo);
        case 'fadada':
          return await this.verifyWithFadada(pdfBuffer, certificateNo);
        default:
          return await this.verifyWithMock(pdfBuffer, certificateNo);
      }
    } catch (error) {
      this.logger.error('签名验证失败: ' + error.message);
      return { valid: false, details: { error: error.message } };
    }
  }

  private async signWithCfca(request: SignatureRequest): Promise<SignatureResult> {
    const apiUrl = process.env.ESIGN_CFCA_API_URL;
    const apiKey = process.env.ESIGN_CFCA_API_KEY;
    const apiSecret = process.env.ESIGN_CFCA_API_SECRET;

    const timestamp = Date.now().toString();
    const signature = this.generateHmacSignature(apiSecret, timestamp + request.certificateNo);

    const formData = new FormData();
    formData.append('file', new Blob([request.pdfBuffer]), request.certificateNo + '.pdf');
    formData.append('sealType', request.sealType);
    formData.append('certNo', request.certificateNo);

    const response = await axios.post(apiUrl + '/api/v1/seal/apply', formData, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      timeout: 30000,
    });

    const data = response.data;
    if (data.code !== 0) {
      throw new Error('CFCA签章失败: ' + data.message);
    }

    const signedPdfResponse = await axios.get(apiUrl + '/api/v1/seal/download/' + data.data.sealId, {
      headers: { 'X-Api-Key': apiKey },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return {
      success: true,
      signedPdfBuffer: Buffer.from(signedPdfResponse.data),
      signatureInfo: {
        provider: 'cfca',
        sealType: request.sealType,
        sealSn: data.data.sealSn,
        signedAt: data.data.signedAt,
        certificateSn: data.data.certificateSn,
        isValid: true,
      },
    };
  }

  private async signWithFadada(request: SignatureRequest): Promise<SignatureResult> {
    const apiUrl = process.env.ESIGN_FADADA_API_URL;
    const apiKey = process.env.ESIGN_FADADA_API_KEY;
    const apiSecret = process.env.ESIGN_FADADA_API_SECRET;

    const timestamp = Date.now().toString();
    const signature = this.generateHmacSignature(apiSecret, timestamp + request.certificateNo);

    const pdfBase64 = request.pdfBuffer.toString('base64');

    const response = await axios.post(apiUrl + '/api/v2/sign/pdf', {
      pdfBase64: pdfBase64,
      sealType: request.sealType,
      certNo: request.certificateNo,
      signerInfo: request.signerInfo,
    }, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const data = response.data;
    if (data.code !== 0) {
      throw new Error('法大大签章失败: ' + data.message);
    }

    const signedPdfBuffer = Buffer.from(data.data.signedPdfBase64, 'base64');

    return {
      success: true,
      signedPdfBuffer,
      signatureInfo: {
        provider: 'fadada',
        sealType: request.sealType,
        sealSn: data.data.signSn,
        signedAt: data.data.signTime,
        certificateSn: data.data.certSn,
        isValid: true,
      },
    };
  }

  private async signWithMock(request: SignatureRequest): Promise<SignatureResult> {
    this.logger.warn('使用模拟签章服务（非生产环境）');

    const sealSn = 'SEAL' + Date.now();
    const certificateSn = 'CERT' + crypto.randomBytes(8).toString('hex').toUpperCase();

    return {
      success: true,
      signedPdfBuffer: request.pdfBuffer,
      signatureInfo: {
        provider: 'mock',
        sealType: request.sealType,
        sealSn: sealSn,
        signedAt: new Date().toISOString(),
        certificateSn: certificateSn,
        isValid: true,
      },
    };
  }

  private async verifyWithCfca(pdfBuffer: Buffer, certificateNo: string): Promise<{ valid: boolean; details?: any }> {
    const apiUrl = process.env.ESIGN_CFCA_API_URL;
    const apiKey = process.env.ESIGN_CFCA_API_KEY;

    const response = await axios.post(apiUrl + '/api/v1/seal/verify', {
      pdfBase64: pdfBuffer.toString('base64'),
      certNo: certificateNo,
    }, {
      headers: { 'X-Api-Key': apiKey },
      timeout: 15000,
    });

    return {
      valid: response.data.code === 0 && response.data.data?.valid === true,
      details: response.data.data,
    };
  }

  private async verifyWithFadada(pdfBuffer: Buffer, certificateNo: string): Promise<{ valid: boolean; details?: any }> {
    const apiUrl = process.env.ESIGN_FADADA_API_URL;
    const apiKey = process.env.ESIGN_FADADA_API_KEY;

    const response = await axios.post(apiUrl + '/api/v2/sign/verify', {
      pdfBase64: pdfBuffer.toString('base64'),
      certNo: certificateNo,
    }, {
      headers: { 'X-Api-Key': apiKey },
      timeout: 15000,
    });

    return {
      valid: response.data.code === 0 && response.data.data?.valid === true,
      details: response.data.data,
    };
  }

  private async verifyWithMock(pdfBuffer: Buffer, certificateNo: string): Promise<{ valid: boolean; details?: any }> {
    return {
      valid: true,
      details: {
        message: '模拟验证环境，签名默认有效',
        certNo: certificateNo,
      },
    };
  }

  private generateHmacSignature(secret: string, data: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
