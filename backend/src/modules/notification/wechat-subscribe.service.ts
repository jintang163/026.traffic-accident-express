import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

export interface WechatSubscribeMessage {
  touser: string;
  template_id: string;
  page?: string;
  data: Record<string, { value: string }>;
}

export interface WechatSendResult {
  success: boolean;
  errcode?: number;
  errmsg?: string;
  msgid?: string;
}

const ACCESS_TOKEN_KEY = 'wechat:access_token';
const ACCESS_TOKEN_TTL = 7000;

@Injectable()
export class WechatSubscribeService {
  private readonly logger = new Logger(WechatSubscribeService.name);
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly enabled: boolean;

  constructor(private cacheService: CacheService) {
    this.appId = process.env.WX_APPID || process.env.WECHAT_APP_ID || '';
    this.appSecret = process.env.WX_SECRET || process.env.WECHAT_APP_SECRET || '';
    this.enabled = !!(this.appId && this.appSecret);
    this.logger.log(`WeChat subscribe service ${this.enabled ? 'enabled' : 'disabled (mock mode)'}`);
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.cacheService.get<string>(ACCESS_TOKEN_KEY);
    if (cached) {
      return cached;
    }

    if (!this.enabled) {
      const mockToken = 'mock_access_token_' + Date.now();
      await this.cacheService.set(ACCESS_TOKEN_KEY, mockToken, ACCESS_TOKEN_TTL);
      return mockToken;
    }

    try {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
      const response = await this.httpGet(url);
      const data = JSON.parse(response);

      if (data.access_token) {
        await this.cacheService.set(ACCESS_TOKEN_KEY, data.access_token, ACCESS_TOKEN_TTL);
        return data.access_token;
      } else {
        throw new Error(`Failed to get access token: ${data.errmsg || 'unknown error'}`);
      }
    } catch (error) {
      this.logger.error('Failed to get access token: ' + error.message);
      throw error;
    }
  }

  async sendSubscribeMessage(message: WechatSubscribeMessage): Promise<WechatSendResult> {
    this.logger.log(`Sending subscribe message to ${message.touser}, template: ${message.template_id}`);

    if (!this.enabled) {
      this.logger.warn('WeChat service disabled, returning mock success');
      return {
        success: true,
        msgid: 'mock_msgid_' + Date.now(),
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

      const postData = JSON.stringify({
        touser: message.touser,
        template_id: message.template_id,
        page: message.page,
        data: message.data,
        miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'trial',
        lang: 'zh_CN',
      });

      const response = await this.httpPost(url, postData);
      const result = JSON.parse(response);

      if (result.errcode === 0) {
        return {
          success: true,
          msgid: result.msgid,
        };
      } else {
        this.logger.warn(`WeChat send failed: ${result.errcode} - ${result.errmsg}`);
        return {
          success: false,
          errcode: result.errcode,
          errmsg: result.errmsg,
        };
      }
    } catch (error) {
      this.logger.error('Failed to send subscribe message: ' + error.message);
      return {
        success: false,
        errcode: -1,
        errmsg: error.message,
      };
    }
  }

  async getTemplateList(): Promise<Array<{
    priTmplId: string;
    title: string;
    content: string;
    example: string;
    type: number;
  }>> {
    if (!this.enabled) {
      return [
        { priTmplId: 'TMPL_LIABILITY', title: '定责完成通知', content: '事故编号{{thing1.DATA}}\n责任结果{{thing2.DATA}}', example: '', type: 2 },
        { priTmplId: 'TMPL_CERTIFICATE', title: '认定书生成通知', content: '事故编号{{thing1.DATA}}\n认定书号{{thing2.DATA}}', example: '', type: 2 },
        { priTmplId: 'TMPL_APPEAL', title: '复核结果通知', content: '申诉编号{{thing1.DATA}}\n复核结果{{thing2.DATA}}', example: '', type: 2 },
        { priTmplId: 'TMPL_EVIDENCE', title: '证据补充提醒', content: '事故编号{{thing1.DATA}}\n补充说明{{thing2.DATA}}', example: '', type: 2 },
      ];
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate?access_token=${accessToken}`;
      const response = await this.httpGet(url);
      const data = JSON.parse(response);
      return data.data || [];
    } catch (error) {
      this.logger.error('Failed to get template list: ' + error.message);
      return [];
    }
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      https.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => { resolve(data); });
      }).on('error', reject);
    });
  }

  private httpPost(url: string, data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };

      const req = https.request(options, (res: any) => {
        let body = '';
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => { resolve(body); });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
