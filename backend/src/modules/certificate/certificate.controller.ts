import { Controller, Get, Post, Body, Param, Query, Request } from '@nestjs/common';
import { CertificateService } from './certificate.service';

@Controller('certificate')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post('generate')
  async generate(@Body('accidentId') accidentId: string, @Request() req) {
    const userId = req.user?.id;
    const certificate = await this.certificateService.generate(accidentId, userId);
    
    return {
      success: true,
      data: certificate,
      message: '认定书生成成功',
    };
  }

  @Get('list')
  async findAll(@Query() query: { page?: number; pageSize?: number; status?: string }, @Request() req) {
    const userId = req.user?.id;
    const result = await this.certificateService.findAll({
      ...query,
      userId,
    });
    
    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Get('statistics')
  async getStatistics(@Request() req) {
    const userId = req.user?.id;
    const stats = await this.certificateService.getStatistics(userId);
    
    return {
      success: true,
      data: stats,
      message: '获取成功',
    };
  }

  @Post('verify')
  async verify(
    @Body('certificateNumber') certificateNumber: string,
    @Body('certificateNo') certificateNo: string,
    @Body('verifyCode') verifyCode: string,
  ) {
    const no = certificateNumber || certificateNo;
    const valid = await this.certificateService.verify(no, verifyCode);
    
    return {
      success: true,
      data: { valid },
      message: valid ? '核验通过' : '核验失败',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const certificate = await this.certificateService.findOne(id);
    
    return {
      success: true,
      data: certificate,
      message: '获取成功',
    };
  }

  @Post(':id/share')
  async share(@Param('id') id: string) {
    const result = await this.certificateService.share(id);
    
    return {
      success: true,
      data: result,
      message: '分享链接生成成功',
    };
  }

  @Get(':id/download')
  async download(@Param('id') id: string) {
    const result = await this.certificateService.download(id);
    
    return {
      success: true,
      data: result,
      message: '下载链接生成成功',
    };
  }

  @Get(':id/print')
  async print(@Param('id') id: string) {
    const result = await this.certificateService.download(id);
    
    return {
      success: true,
      data: result,
      message: '打印数据获取成功',
    };
  }

  @Post(':id/send')
  async send(
    @Param('id') id: string,
    @Body('phone') phone: string,
  ) {
    const result = await this.certificateService.send(id, phone);
    
    return {
      success: true,
      data: result,
      message: '发送成功',
    };
  }
}
