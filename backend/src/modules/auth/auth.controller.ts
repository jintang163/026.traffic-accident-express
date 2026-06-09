import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/wechat')
  async loginByWechat(@Body('code') code: string) {
    const result = await this.authService.loginByWechat(code);
    
    return {
      success: true,
      data: result,
      message: '登录成功',
    };
  }

  @Post('login/phone')
  async loginByPhone(
    @Body('phone') phone: string,
    @Body('code') code: string,
  ) {
    const result = await this.authService.loginByPhone(phone, code);
    
    return {
      success: true,
      data: result,
      message: '登录成功',
    };
  }

  @Post('wechat-phone')
  async getWechatPhone(@Body('code') code: string) {
    const phoneNumber = await this.authService.getWechatPhoneNumber(code);
    
    return {
      success: true,
      data: { phoneNumber },
      message: '手机号获取成功',
    };
  }
}
