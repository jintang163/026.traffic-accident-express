import { Controller, Get, Post, Body, Param, Query, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import * as dayjs from 'dayjs';
import { CertificateService } from './certificate.service';
import { getAccidentTypeText, getStatusText } from '../../utils/validator';

@Controller('certificate')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get('verify')
  async verifyPage(@Query('no') no: string, @Query('code') code: string, @Res() res: Response) {
    const result = await this.certificateService.verify(no, code);

    const cert = result.certificate;
    const isAgreement = cert?.templateType === 'agreement';
    const title = isAgreement ? '道路交通事故自行协商协议书核验' : '道路交通事故认定书核验';

    const statusBadge = result.valid
      ? '<div class="status valid"><span class="icon">✓</span> 核验通过 · 文件真实有效</div>'
      : '<div class="status invalid"><span class="icon">✕</span> 核验未通过 · ' + (result.message || '请核对信息') + '</div>';

    let detailBlock = '';
    if (cert) {
      const acc = cert.accident || {};
      const partiesHtml = (cert.parties || []).map((p, i) => {
        const label = i === 0 ? '甲方' : '乙方';
        const liabMap: Record<string, string> = { full: '全部责任', primary: '主要责任', secondary: '次要责任', none: '无责任' };
        return `
          <div class="party-card">
            <div class="party-label">${label}</div>
            <div class="party-grid">
              <div><span>姓名</span><b>${p.name}</b></div>
              <div><span>车牌</span><b>${p.plateNo}</b></div>
              <div><span>电话</span><b>${p.phone || '—'}</b></div>
              <div><span>责任</span><b class="liability">${liabMap[p.liability] || '—'}</b></div>
              <div class="full"><span>保险公司</span><b>${p.insuranceCompany || '—'}</b></div>
            </div>
          </div>`;
      }).join('');

      const sig = cert.signatureInfo;
      const sigHtml = sig ? `
        <div class="section">
          <div class="sec-title">电子签章信息</div>
          <div class="info-grid">
            <div><span>签章服务商</span><b>${sig.provider}</b></div>
            <div><span>印章类型</span><b>${sig.sealType === 'police' ? '交警部门印章' : '平台电子印章'}</b></div>
            <div><span>印章序列号</span><b class="mono">${sig.sealSn}</b></div>
            <div><span>证书序列号</span><b class="mono">${sig.certificateSn}</b></div>
            <div class="full"><span>签章时间</span><b>${dayjs(sig.signedAt).format('YYYY-MM-DD HH:mm:ss')}</b></div>
          </div>
        </div>` : '';

      const pdfBlock = cert.pdfUrl ? `
        <div class="download-bar">
          <a href="${cert.pdfUrl}" target="_blank" class="btn-primary">📄 下载PDF文件</a>
          <a href="/api/certificate/${cert.id}/pdf" target="_blank" class="btn-secondary">在线预览PDF</a>
        </div>` : '';

      const qrBlock = cert.qrCodeUrl ? `
        <div class="qr-block">
          <img src="${cert.qrCodeUrl}" alt="核验二维码" />
          <div class="qr-tip">扫描二维码再次核验</div>
        </div>` : '';

      detailBlock = `
        <div class="cert-card">
          <div class="cert-header">
            <div>
              <div class="cert-no">${cert.certificateNo}</div>
              <div class="cert-sub">${isAgreement ? '自行协商协议书' : '事故认定书（简易程序）'}</div>
            </div>
            <div><span class="tag">${getStatusText(cert.status)}</span></div>
          </div>

          <div class="section">
            <div class="sec-title">事故信息</div>
            <div class="info-grid">
              <div><span>事故编号</span><b class="mono">${acc.reportNo || '—'}</b></div>
              <div><span>事故类型</span><b>${getAccidentTypeText(acc.accidentType) || '—'}</b></div>
              <div class="full"><span>发生时间</span><b>${dayjs(acc.occurTime).format('YYYY年MM月DD日 HH:mm')}</b></div>
              <div class="full"><span>发生地点</span><b>${acc.location || '—'}</b></div>
            </div>
          </div>

          <div class="section">
            <div class="sec-title">当事人信息</div>
            <div class="parties">${partiesHtml || '<div class="empty">暂无信息</div>'}</div>
          </div>

          <div class="section">
            <div class="sec-title">事故事实</div>
            <div class="paragraph">${acc.description || '—'}</div>
          </div>

          <div class="section">
            <div class="sec-title">责任认定</div>
            <div class="paragraph">${acc.liabilityResult?.liabilityDescription || '—'}</div>
            ${acc.liabilityResult?.legalBasis ? `<div class="legal">法律依据：${acc.liabilityResult.legalBasis}</div>` : ''}
          </div>

          ${sigHtml}

          <div class="footer-info">
            <div>出具单位：${cert.issuedBy}</div>
            <div>出具时间：${dayjs(cert.issuedAt).format('YYYY年MM月DD日')}</div>
            <div>核验码：<span class="mono">${cert.verifyCode}</span></div>
          </div>

          ${qrBlock}
          ${pdfBlock}
        </div>`;
    } else {
      detailBlock = `
        <div class="empty-tip">
          <div class="empty-icon">🔍</div>
          <p>未查询到相关认定书，请核验认定书编号与核验码是否正确。</p>
          <a href="/verify" class="btn-secondary">返回核验</a>
        </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} - 交通事故快速处理系统</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:linear-gradient(135deg,#eef2ff 0%,#f0f9ff 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#1f2937;min-height:100vh;padding:20px}
.container{max-width:860px;margin:0 auto}
.header{text-align:center;padding:32px 20px}
.logo{display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#1e5efa,#3b82f6);border-radius:18px;line-height:64px;font-size:32px;color:#fff;margin-bottom:14px;box-shadow:0 8px 24px rgba(30,94,250,.2)}
.title{font-size:26px;font-weight:700;color:#111827;margin-bottom:4px}
.subtitle{font-size:14px;color:#6b7280}
.status{margin:0 auto 20px;padding:14px 22px;border-radius:12px;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px}
.status.valid{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.status.invalid{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
.status .icon{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px}
.status.valid .icon{background:#10b981}
.status.invalid .icon{background:#ef4444}
.tag{display:inline-block;padding:4px 12px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:500}
.tag.revoked{background:#fef2f2;color:#991b1b}
.cert-card{background:#fff;border-radius:18px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
.cert-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #f3f4f6;padding-bottom:16px;margin-bottom:20px}
.cert-no{font-size:20px;font-weight:700;color:#1e5efa;letter-spacing:.5px}
.cert-sub{font-size:13px;color:#6b7280;margin-top:4px}
.section{margin-bottom:20px}
.sec-title{font-size:15px;font-weight:600;color:#111827;margin-bottom:12px;padding-left:10px;border-left:3px solid #1e5efa}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px}
.info-grid .full{grid-column:1/-1}
.info-grid > div{padding:10px 14px;background:#f9fafb;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.info-grid span{font-size:13px;color:#6b7280;flex-shrink:0}
.info-grid b{font-size:14px;color:#111827;font-weight:500;text-align:right;word-break:break-all}
.mono{font-family:'Courier New',monospace;letter-spacing:.5px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.party-card{background:#f9fafb;border-radius:12px;padding:14px;border:1px solid #e5e7eb}
.party-label{display:inline-block;padding:2px 10px;border-radius:6px;background:#1e5efa;color:#fff;font-size:12px;font-weight:600;margin-bottom:10px}
.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.party-grid .full{grid-column:1/-1}
.party-grid > div{display:flex;align-items:center;justify-content:space-between;gap:8px}
.party-grid span{font-size:12px;color:#9ca3af;flex-shrink:0}
.party-grid b{font-size:13px;font-weight:500;text-align:right;word-break:break-all}
.party-grid b.liability{color:#1d4ed8}
.paragraph{padding:14px;background:#f9fafb;border-radius:10px;font-size:14px;line-height:1.8;color:#374151}
.legal{margin-top:10px;padding:10px 14px;background:#fff7ed;border-radius:8px;border-left:3px solid #f59e0b;font-size:13px;color:#92400e;line-height:1.6}
.footer-info{border-top:1px dashed #e5e7eb;padding-top:14px;font-size:13px;color:#6b7280;line-height:2;text-align:right}
.qr-block{margin-top:18px;padding:18px;background:#f9fafb;border-radius:12px;text-align:center}
.qr-block img{width:140px;height:140px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.08)}
.qr-tip{font-size:12px;color:#9ca3af;margin-top:8px}
.download-bar{margin-top:18px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn-primary{display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#1e5efa,#3b82f6);color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(30,94,250,.25)}
.btn-secondary{display:inline-block;padding:10px 22px;background:#fff;color:#1e5efa;border:1px solid #bfdbfe;border-radius:10px;text-decoration:none;font-size:14px;font-weight:500}
.empty-tip{padding:60px 20px;text-align:center}
.empty-icon{font-size:60px;margin-bottom:16px}
.empty-tip p{font-size:14px;color:#6b7280;margin-bottom:20px}
.verify-form{max-width:460px;margin:0 auto;background:#fff;padding:28px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
.form-item{margin-bottom:16px}
.form-label{font-size:13px;color:#374151;margin-bottom:6px;font-weight:500}
.form-input{width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:all .2s}
.form-input:focus{border-color:#1e5efa;box-shadow:0 0 0 3px rgba(30,94,250,.1)}
.form-submit{width:100%;padding:12px;background:linear-gradient(135deg,#1e5efa,#3b82f6);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(30,94,250,.25)}
.form-hint{text-align:center;font-size:12px;color:#9ca3af;margin-top:16px}
@media(max-width:640px){
  .parties,.info-grid{grid-template-columns:1fr}
  .cert-card{padding:18px}
  .title{font-size:20px}
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">🚗</div>
    <div class="title">${title}</div>
    <div class="subtitle">交通事故快速处理系统 · 官方核验平台</div>
  </div>
  ${statusBadge}
  ${no && code ? detailBlock : `
    <form class="verify-form" method="GET" action="/api/certificate/verify">
      <div class="form-item">
        <div class="form-label">认定书编号 / 协议书编号</div>
        <input name="no" class="form-input" placeholder="请输入认定书编号，如 RD202606080001" value="${no || ''}" required />
      </div>
      <div class="form-item">
        <div class="form-label">核验码</div>
        <input name="code" class="form-input" placeholder="请输入14位核验码，如 VERIFYXXXXXXXX" value="${code || ''}" required />
      </div>
      <button class="form-submit" type="submit">立即核验真伪</button>
      <div class="form-hint">扫描认定书/协议书上的二维码可直接进入本页面完成核验</div>
    </form>`}
</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(html);
  }

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
  async findAll(@Query() query: { page?: number; pageSize?: number; status?: string; templateType?: string }, @Request() req) {
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
  async verifyPost(
    @Body('certificateNumber') certificateNumber: string,
    @Body('certificateNo') certificateNo: string,
    @Body('verifyCode') verifyCode: string,
  ) {
    const no = certificateNumber || certificateNo;
    const result = await this.certificateService.verify(no, verifyCode);

    return {
      success: true,
      data: {
        valid: result.valid,
        certificate: result.certificate || null,
      },
      message: result.message || (result.valid ? '核验通过' : '核验失败'),
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

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const pdfBuffer = await this.certificateService.getPdfBuffer(id);
      const certificate = await this.certificateService.findOne(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + certificate.certificateNo + '.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      res.end(pdfBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'PDF下载失败: ' + error.message,
      });
    }
  }

  @Post(':id/regenerate-pdf')
  async regeneratePdf(@Param('id') id: string) {
    const certificate = await this.certificateService.regeneratePdf(id);

    return {
      success: true,
      data: {
        pdfUrl: certificate.pdfUrl,
        qrCodeUrl: certificate.qrCodeUrl,
        signatureInfo: certificate.signatureInfo,
        pdfGeneratedAt: certificate.pdfGeneratedAt,
        templateType: certificate.templateType,
      },
      message: 'PDF重新生成成功',
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

  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string) {
    const result = await this.certificateService.getThumbnail(id);
    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Post(':id/regenerate-thumbnail')
  async regenerateThumbnail(@Param('id') id: string) {
    const cert = await this.certificateService.generateThumbnail(id);
    return {
      success: true,
      data: { thumbnailUrl: cert.thumbnailUrl },
      message: '缩略图生成成功',
    };
  }

  @Post(':id/send-email')
  async sendEmail(
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return {
        success: false,
        message: '邮箱格式不正确',
      };
    }
    const result = await this.certificateService.sendEmail(id, email);
    return {
      success: result.success,
      data: { mockSent: result.mockSent },
      message: result.message,
    };
  }
}
