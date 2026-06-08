import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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
    
    const mockUser = {
      id: uuidv4(),
      openid: `wx_${uuidv4().slice(0, 16)}`,
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
