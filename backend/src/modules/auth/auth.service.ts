import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface UserPayload {
  id: string;
  openid: string;
  nickname: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async loginByWechat(code: string) {
    console.log('[AuthService] 微信登录:', code);
    
    const appid = process.env.WX_APPID || '';
    const secret = process.env.WX_SECRET || '';
    
    let openid = `wx_${uuidv4().slice(0, 16)}`;
    let sessionKey = '';
    
    if (appid && secret) {
      try {
        const https = require('https');
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
        
        const wxResult = await new Promise<any>((resolve, reject) => {
          https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(JSON.parse(data)); });
          }).on('error', reject);
        });
        
        if (wxResult.openid) {
          openid = wxResult.openid;
          sessionKey = wxResult.session_key || '';
        }
      } catch (error) {
        console.warn('[AuthService] 微信code2Session调用失败，使用mock数据:', error);
      }
    }
    
    const mockUser = {
      id: uuidv4(),
      openid,
      nickname: '用户' + Math.floor(Math.random() * 10000),
      avatarUrl: '',
      phone: '',
    };
    
    const token = this.generateToken(mockUser);
    
    return {
      user: mockUser,
      token,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  async loginByPhone(phone: string, code: string) {
    console.log('[AuthService] 手机号登录:', phone);
    
    const mockUser = {
      id: uuidv4(),
      openid: '',
      nickname: phone.slice(-4),
      avatarUrl: '',
      phone,
    };
    
    const token = this.generateToken(mockUser);
    
    return {
      user: mockUser,
      token,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  async getWechatPhoneNumber(code: string): Promise<string> {
    console.log('[AuthService] 获取微信手机号, code:', code);
    
    const appid = process.env.WX_APPID || '';
    const secret = process.env.WX_SECRET || '';
    
    if (!appid || !secret) {
      console.warn('[AuthService] 微信配置缺失，返回mock手机号');
      return '138' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    }
    
    try {
      const https = require('https');
      
      const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
      const tokenResult = await new Promise<any>((resolve, reject) => {
        https.get(tokenUrl, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => { resolve(JSON.parse(data)); });
        }).on('error', reject);
      });
      
      if (!tokenResult.access_token) {
        throw new Error('获取access_token失败: ' + (tokenResult.errmsg || 'unknown'));
      }
      
      const accessToken = tokenResult.access_token;
      const phoneUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
      
      const phoneResult = await new Promise<any>((resolve, reject) => {
        const postData = JSON.stringify({ code });
        const urlObj = new URL(phoneUrl);
        
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => { resolve(JSON.parse(data)); });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
      });
      
      if (phoneResult.errcode === 0 && phoneResult.phone_info) {
        const phoneNumber = phoneResult.phone_info.phoneNumber || phoneResult.phone_info.purePhoneNumber;
        console.log('[AuthService] 微信手机号获取成功');
        return phoneNumber;
      } else {
        throw new Error('微信手机号获取失败: ' + (phoneResult.errmsg || 'unknown'));
      }
    } catch (error) {
      console.error('[AuthService] 微信手机号获取失败:', error);
      return '138' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    }
  }

  private generateToken(user: UserPayload): string {
    const payload = {
      sub: user.id,
      openid: user.openid,
      nickname: user.nickname,
    };
    
    return this.jwtService.sign(payload);
  }

  async validateUser(payload: UserPayload) {
    return {
      id: payload.id,
      openid: payload.openid,
      nickname: payload.nickname,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
