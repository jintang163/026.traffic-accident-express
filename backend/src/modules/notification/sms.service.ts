import { Injectable, Logger } from '@nestjs/common';

export interface SmsSendResult {
  success: boolean;
  requestId?: string;
  code?: string;
  message?: string;
  bizId?: string;
}

export type SmsProvider = 'aliyun' | 'tencent' | 'mock';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private provider: SmsProvider;

  constructor() {
    this.provider = this.detectProvider();
    this.logger.log(`SMS service initialized with provider: ${this.provider}`);
  }

  private detectProvider(): SmsProvider {
    if (process.env.SMS_PROVIDER === 'aliyun' && process.env.ALIYUN_SMS_ACCESS_KEY_ID) {
      return 'aliyun';
    }
    if (process.env.SMS_PROVIDER === 'tencent' && process.env.TENCENT_SMS_SECRET_ID) {
      return 'tencent';
    }
    return 'mock';
  }

  async sendSms(
    phone: string,
    templateCode: string,
    templateParam?: Record<string, string>,
  ): Promise<SmsSendResult> {
    this.logger.log(`Sending SMS to ${phone}, template: ${templateCode}`);

    try {
      let result: SmsSendResult;

      switch (this.provider) {
        case 'aliyun':
          result = await this.sendAliyunSms(phone, templateCode, templateParam);
          break;
        case 'tencent':
          result = await this.sendTencentSms(phone, templateCode, templateParam);
          break;
        default:
          result = await this.sendMockSms(phone, templateCode, templateParam);
      }

      this.logger.log(`SMS send result: ${result.success ? 'success' : 'failed'} - ${phone}`);
      return result;
    } catch (error) {
      this.logger.error(`SMS send failed: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  private async sendMockSms(
    phone: string,
    templateCode: string,
    templateParam?: Record<string, string>,
  ): Promise<SmsSendResult> {
    this.logger.warn(`[MOCK SMS] To: ${phone}, Template: ${templateCode}, Params: ${JSON.stringify(templateParam || {})}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      requestId: 'mock_req_' + Date.now(),
      bizId: 'mock_biz_' + Date.now(),
      code: 'OK',
      message: 'Mock SMS sent successfully',
    };
  }

  private async sendAliyunSms(
    phone: string,
    templateCode: string,
    templateParam?: Record<string, string>,
  ): Promise<SmsSendResult> {
    const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID || '';
    const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '';
    const signName = process.env.ALIYUN_SMS_SIGN_NAME || '';

    const Core = require('@alicloud/pop-core');
    const client = new Core({
      accessKeyId,
      accessKeySecret,
      endpoint: 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25',
    });

    const params = {
      PhoneNumbers: phone,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify(templateParam || {}),
    };

    const requestOption = { method: 'POST' };

    try {
      const result = await client.request('SendSms', params, requestOption);
      return {
        success: result.Code === 'OK',
        requestId: result.RequestId,
        bizId: result.BizId,
        code: result.Code,
        message: result.Message,
      };
    } catch (error: any) {
      return {
        success: false,
        code: error.code,
        message: error.message,
      };
    }
  }

  private async sendTencentSms(
    phone: string,
    templateCode: string,
    templateParam?: Record<string, string>,
  ): Promise<SmsSendResult> {
    const secretId = process.env.TENCENT_SMS_SECRET_ID || '';
    const secretKey = process.env.TENCENT_SMS_SECRET_KEY || '';
    const appId = process.env.TENCENT_SMS_APP_ID || '';
    const signName = process.env.TENCENT_SMS_SIGN_NAME || '';
    const region = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';

    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const SmsClient = tencentcloud.sms.v20210111.Client;

    const clientConfig = {
      credential: { secretId, secretKey },
      region,
      profile: {
        httpProfile: { endpoint: 'sms.tencentcloudapi.com' },
      },
    };

    const client = new SmsClient(clientConfig);

    const params = {
      PhoneNumberSet: [phone.startsWith('+') ? phone : '+86' + phone],
      SmsSdkAppId: appId,
      SignName: signName,
      TemplateId: templateCode,
      TemplateParamSet: templateParam ? Object.values(templateParam) : [],
    };

    try {
      const result = await client.SendSms(params);
      const status = result.SendStatusSet?.[0];
      return {
        success: status?.Code === 'Ok',
        requestId: result.RequestId,
        bizId: status?.SerialNo,
        code: status?.Code,
        message: status?.Message,
      };
    } catch (error: any) {
      return {
        success: false,
        code: error.code,
        message: error.message,
      };
    }
  }

  getProvider(): SmsProvider {
    return this.provider;
  }
}
