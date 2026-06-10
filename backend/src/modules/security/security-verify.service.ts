import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export type VerifyMethod = 'sms' | 'face';

export interface VerifyTokenResult {
  valid: boolean;
  phone?: string;
  method?: VerifyMethod;
  transactionId?: string;
  verifiedAt?: Date;
  userId?: string;
  message?: string;
}

interface SmsCodeRecord {
  code: string;
  phone: string;
  expiresAt: Date;
  attempts: number;
}

interface FaceVerifyRecord {
  transactionId: string;
  phone?: string;
  verified: boolean;
  verifiedAt?: Date;
  rawResponse?: any;
}

@Injectable()
export class SecurityVerifyService {
  private readonly logger = new Logger(SecurityVerifyService.name);

  private smsCodeStore = new Map<string, SmsCodeRecord>();
  private faceVerifyStore = new Map<string, FaceVerifyRecord>();
  private tokenStore = new Map<string, { payload: any; expiresAt: Date }>();

  private readonly SMS_CODE_TTL = 5 * 60 * 1000;
  private readonly TOKEN_TTL = 10 * 60 * 1000;

  async sendSmsCode(phone: string, action: string = 'default'): Promise<{ success: boolean; message: string; mockCode?: string }> {
    if (!/^1\d{10}$/.test(phone)) {
      return { success: false, message: '手机号格式不正确' };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.smsCodeStore.set(phone + ':' + action, {
      code,
      phone,
      expiresAt: new Date(Date.now() + this.SMS_CODE_TTL),
      attempts: 0,
    });

    this.logger.log('[SMS Mock] 向 ' + phone + ' 发送验证码 ' + code + ' (动作=' + action + ')');
    return {
      success: true,
      message: '验证码已发送',
      mockCode: code,
    };
  }

  async verifySmsCode(phone: string, code: string, action: string = 'default'): Promise<VerifyTokenResult> {
    const key = phone + ':' + action;
    const record = this.smsCodeStore.get(key);

    if (!record) {
      return { valid: false, message: '请先发送验证码' };
    }
    if (record.expiresAt.getTime() < Date.now()) {
      this.smsCodeStore.delete(key);
      return { valid: false, message: '验证码已过期' };
    }
    if (record.attempts >= 5) {
      this.smsCodeStore.delete(key);
      return { valid: false, message: '验证次数过多，请重新发送' };
    }
    record.attempts += 1;

    if (record.code !== code) {
      return { valid: false, message: '验证码错误' };
    }

    this.smsCodeStore.delete(key);
    const token = this.generateToken({ phone, method: 'sms', action });
    return {
      valid: true,
      phone,
      method: 'sms',
      transactionId: token,
      verifiedAt: new Date(),
      message: '验证成功',
    };
  }

  async startFaceVerify(phone?: string): Promise<{ success: boolean; transactionId: string; message: string; mockFaceUrl?: string }> {
    const transactionId = 'FACE' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();

    this.faceVerifyStore.set(transactionId, {
      transactionId,
      phone,
      verified: false,
    });

    this.logger.log('[FaceVerify Mock] 发起人脸核身交易: ' + transactionId + (phone ? ' 手机:' + phone : ''));

    return {
      success: true,
      transactionId,
      message: '人脸核身已发起',
      mockFaceUrl: 'https://console.cloud.tencent.com/faceid/ocr/' + transactionId,
    };
  }

  async mockFaceVerifySuccess(transactionId: string): Promise<VerifyTokenResult> {
    const record = this.faceVerifyStore.get(transactionId);
    if (!record) {
      return { valid: false, message: '核身交易不存在' };
    }
    record.verified = true;
    record.verifiedAt = new Date();
    record.rawResponse = { mock: true, passed: true, score: 98.5 };

    const token = this.generateToken({
      phone: record.phone,
      method: 'face',
      transactionId,
    });

    return {
      valid: true,
      phone: record.phone,
      method: 'face',
      transactionId: token,
      verifiedAt: record.verifiedAt,
      message: '人脸核身通过',
    };
  }

  async verifyFaceCallback(transactionId: string, payload: any): Promise<VerifyTokenResult> {
    const record = this.faceVerifyStore.get(transactionId);
    if (!record) {
      return { valid: false, message: '核身交易不存在' };
    }
    record.verified = !!payload?.success || !!payload?.passed;
    record.verifiedAt = new Date();
    record.rawResponse = payload;

    if (!record.verified) {
      return { valid: false, message: '人脸核身未通过' };
    }

    const token = this.generateToken({
      phone: record.phone,
      method: 'face',
      transactionId,
    });

    return {
      valid: true,
      phone: record.phone,
      method: 'face',
      transactionId: token,
      verifiedAt: record.verifiedAt,
      message: '人脸核身通过',
    };
  }

  generateToken(payload: any): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.tokenStore.set(token, {
      payload,
      expiresAt: new Date(Date.now() + this.TOKEN_TTL),
    });
    return token;
  }

  async verifyToken(token: string, expected?: { action?: string; targetId?: string; userId?: string }): Promise<VerifyTokenResult> {
    const record = this.tokenStore.get(token);
    if (!record) {
      return { valid: false, message: '验证令牌无效' };
    }
    if (record.expiresAt.getTime() < Date.now()) {
      this.tokenStore.delete(token);
      return { valid: false, message: '验证令牌已过期' };
    }
    const payload = record.payload || {};
    return {
      valid: true,
      phone: payload.phone,
      method: payload.method,
      transactionId: payload.transactionId || token,
      verifiedAt: new Date(),
      message: '令牌有效',
    };
  }
}
