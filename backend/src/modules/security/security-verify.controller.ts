import { Injectable, Controller, Post, Get, Query, Body, Param } from '@nestjs/common';
import { SecurityVerifyService } from './security-verify.service';

@Injectable()
@Controller('security')
export class SecurityVerifyController {
  constructor(private readonly securityVerifyService: SecurityVerifyService) {}

  @Post('sms/send')
  async sendSmsCode(@Body() body: { phone: string; action?: string }) {
    const result = await this.securityVerifyService.sendSmsCode(body.phone, body.action);
    return {
      success: result.success,
      message: result.message,
      data: result.mockCode ? { mockCode: result.mockCode } : null,
    };
  }

  @Post('sms/verify')
  async verifySmsCode(@Body() body: { phone: string; code: string; action?: string }) {
    const result = await this.securityVerifyService.verifySmsCode(body.phone, body.code, body.action);
    return {
      success: result.valid,
      message: result.message,
      data: result.valid ? { token: result.transactionId, method: 'sms' } : null,
    };
  }

  @Post('face/start')
  async startFaceVerify(@Body() body: { phone?: string }) {
    const result = await this.securityVerifyService.startFaceVerify(body.phone);
    return {
      success: result.success,
      message: result.message,
      data: { transactionId: result.transactionId, mockFaceUrl: result.mockFaceUrl },
    };
  }

  @Post('face/mock-pass')
  async mockFacePass(@Body() body: { transactionId: string }) {
    const result = await this.securityVerifyService.mockFaceVerifySuccess(body.transactionId);
    return {
      success: result.valid,
      message: result.message,
      data: result.valid ? { token: result.transactionId, method: 'face' } : null,
    };
  }

  @Post('face/callback')
  async faceCallback(@Body() body: { transactionId: string; payload: any }) {
    const result = await this.securityVerifyService.verifyFaceCallback(body.transactionId, body.payload);
    return {
      success: result.valid,
      message: result.message,
    };
  }

  @Post('token/verify')
  async verifyToken(@Body() body: { token: string }) {
    const result = await this.securityVerifyService.verifyToken(body.token);
    return {
      success: result.valid,
      message: result.message,
      data: result.valid ? { method: result.method, phone: result.phone, verifiedAt: result.verifiedAt } : null,
    };
  }
}
