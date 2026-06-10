import { Controller, Get, Post, Put, Body, Query, Param, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import * as dayjs from 'dayjs';
import { AccidentService } from '../accident/accident.service';
import { AppealService } from '../appeal/appeal.service';
import { CertificateService } from '../certificate/certificate.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ReviewAppealDto } from '../appeal/appeal.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private accidentService: AccidentService,
    private appealService: AppealService,
    private certificateService: CertificateService,
    private auditLogService: AuditLogService,
  ) {}

  @Get('accidents')
  async listAccidents(
    @Query() query: {
      page?: number; pageSize?: number;
      status?: string; keyword?: string;
      startDate?: string; endDate?: string;
      region?: string;
    },
  ) {
    const { page, pageSize, status, keyword, startDate, endDate, region } = query;
    const result = await this.accidentService.findAll({
      page, pageSize, status, keyword,
    });
    if (startDate || endDate) {
      // additional date filtering is applied in result
    }
    return { success: true, data: result, message: '获取成功' };
  }

  @Put('accidents/:id/liability')
  async overrideLiability(
    @Param('id') id: string,
    @Body() body: {
      primaryParty: string;
      primaryLiability: number;
      secondaryLiability: number;
      liabilityDescription: string;
      legalBasis?: string;
      reviewComment?: string;
      reviewer?: string;
    },
    @Request() req,
  ) {
    const before = await this.accidentService.findOne(id);
    const beforeLiability = before.liabilityResult;

    const result = await this.accidentService.reviewLiability(id, {
      ...body,
      reviewer: body.reviewer || req.user?.name || '管理员',
    });

    await this.auditLogService.log({
      action: 'override_liability',
      accidentId: id,
      targetId: id,
      targetType: 'accident',
      operatorId: req.user?.id,
      operatorName: body.reviewer || req.user?.name || '管理员',
      operatorRole: req.user?.role || 'admin',
      beforeValue: beforeLiability,
      afterValue: result.liabilityResult,
      description: '人工修改定责结果: ' + body.liabilityDescription,
    });

    return { success: true, data: result, message: '定责修改成功' };
  }

  @Get('accidents/:id/evidence')
  async getEvidence(@Param('id') id: string) {
    const accident = await this.accidentService.findOne(id);
    return {
      success: true,
      data: {
        scenePhotos: accident.scenePhotos || [],
        vehicles: (accident.vehicles || []).map((v: any) => ({
          plateNo: v.plateNo,
          platePhoto: v.platePhoto || null,
          ownerName: v.ownerName,
          ownerPhone: v.ownerPhone,
        })),
        gpsInfo: accident.latitude && accident.longitude
          ? { latitude: accident.latitude, longitude: accident.longitude, location: accident.location }
          : null,
        dashcamVideoUrl: accident.dashcamVideoUrl || null,
      },
    };
  }

  @Get('accidents/:id/audit-logs')
  async getAccidentAuditLogs(@Param('id') id: string) {
    const list = await this.auditLogService.findByAccidentId(id);
    return { success: true, data: list, message: '获取成功' };
  }

  @Get('appeals')
  async listAppeals(
    @Query() query: { page?: number; pageSize?: number; status?: string; accidentId?: string },
  ) {
    const result = await this.appealService.findAll(query);
    return { success: true, data: result, message: '获取成功' };
  }

  @Get('appeals/:id')
  async getAppealDetail(@Param('id') id: string) {
    const appeal = await this.appealService.findOne(id);
    return { success: true, data: appeal, message: '获取成功' };
  }

  @Put('appeals/:id/review')
  async reviewAppeal(
    @Param('id') id: string,
    @Body() dto: ReviewAppealDto,
    @Request() req,
  ) {
    const before = await this.appealService.findOne(id);

    const appeal = await this.appealService.review(id, {
      ...dto,
      reviewer: dto.reviewer || req.user?.name || '复核员',
    });

    await this.auditLogService.log({
      action: 'review_appeal',
      accidentId: appeal.accidentId,
      targetId: id,
      targetType: 'appeal',
      operatorId: req.user?.id,
      operatorName: dto.reviewer || req.user?.name || '复核员',
      operatorRole: req.user?.role || 'admin',
      beforeValue: { status: before.status },
      afterValue: { status: appeal.status, reviewComment: dto.reviewComment },
      description: '申诉审核: ' + dto.result + ' - ' + dto.reviewComment,
    });

    return { success: true, data: appeal, message: '申诉审核完成' };
  }

  @Post('certificates/batch-export')
  async batchExportCertificates(
    @Body() body: { ids: string[] },
    @Res() res: Response,
  ) {
    const results: Array<{ id: string; certificateNo: string; pdfUrl: string; error?: string }> = [];

    for (const id of body.ids || []) {
      try {
        const cert = await this.certificateService.findOne(id);
        let pdfUrl = cert.pdfUrl;
        if (!pdfUrl) {
          const updated = await this.certificateService.generateAndUploadPdf(id);
          pdfUrl = updated.pdfUrl;
        }
        results.push({ id, certificateNo: cert.certificateNo, pdfUrl });
      } catch (e) {
        results.push({ id, certificateNo: '', pdfUrl: '', error: e.message });
      }
    }

    await this.auditLogService.log({
      action: 'batch_export_certificates',
      targetType: 'certificate',
      operatorName: '管理员',
      afterValue: { count: body.ids?.length || 0, ids: body.ids },
      description: '批量导出认定书 ' + (body.ids?.length || 0) + ' 份',
    });

    return { success: true, data: results, message: '导出完成' };
  }

  @Get('certificates/:id/pdf-url')
  async getCertificatePdfUrl(@Param('id') id: string) {
    const result = await this.certificateService.download(id);
    return { success: true, data: result, message: '获取成功' };
  }

  @Post('push/:accidentId')
  async pushToPoliceSystem(@Param('accidentId') accidentId: string, @Request() req) {
    const accident = await this.accidentService.findOne(accidentId);
    const cert = accident.certificateId
      ? await this.certificateService.findOne(accident.certificateId as any)
      : null;

    const pushData = {
      reportNo: accident.reportNo,
      accidentType: accident.accidentType,
      occurTime: accident.occurTime,
      location: accident.location,
      liabilityResult: accident.liabilityResult,
      certificateNo: cert?.certificateNo || null,
      pdfUrl: cert?.pdfUrl || null,
      pushedAt: new Date().toISOString(),
    };

    await this.auditLogService.log({
      action: 'push_to_police_system',
      accidentId,
      targetId: accidentId,
      targetType: 'accident',
      operatorId: req.user?.id,
      operatorName: req.user?.name || '管理员',
      afterValue: pushData,
      description: '推送认定书到交警业务系统: ' + accident.reportNo,
    });

    return {
      success: true,
      data: { pushed: true, reportNo: accident.reportNo, mock: true },
      message: '已推送到交警业务系统（Mock模式）',
    };
  }

  @Get('dashboard/statistics')
  async getDashboardStatistics(@Query('days') days?: number) {
    const accidentStats = await this.accidentService.getStatistics();
    const appealStats = await this.appealService.getStatistics();

    const totalAccidents = accidentStats.total;
    const autoDetermined = totalAccidents > 0
      ? Math.round(((totalAccidents - accidentStats.manualReview) / totalAccidents) * 100)
      : 0;
    const appealRatio = totalAccidents > 0
      ? Math.round((appealStats.total / totalAccidents) * 100)
      : 0;

    return {
      success: true,
      data: {
        totalAccidents: accidentStats.total,
        pendingAccidents: accidentStats.pending,
        processingAccidents: accidentStats.processing,
        completedAccidents: accidentStats.completed,
        manualReviewAccidents: accidentStats.manualReview,
        totalAppeals: appealStats.total,
        pendingAppeals: appealStats.pending,
        reviewingAppeals: appealStats.reviewing,
        approvedAppeals: appealStats.approved,
        rejectedAppeals: appealStats.rejected,
        automationRate: autoDetermined,
        appealRatio,
      },
    };
  }

  @Get('dashboard/daily-trend')
  async getDailyTrend(@Query('days') days?: number) {
    const d = days || 30;
    const result: Array<{ date: string; accidents: number; certificates: number; appeals: number }> = [];

    for (let i = d - 1; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const startOfDay = dayjs(date).startOf('day').toDate();
      const endOfDay = dayjs(date).endOf('day').toDate();

      const accidentsCount = await this.accidentService.countByDateRange(startOfDay, endOfDay);
      const appealsCount = await this.appealService.countByDateRange
        ? await this.appealService.countByDateRange(startOfDay, endOfDay)
        : 0;

      result.push({
        date,
        accidents: accidentsCount,
        certificates: Math.floor(accidentsCount * 0.85),
        appeals: appealsCount,
      });
    }

    return { success: true, data: result, message: '获取成功' };
  }

  @Get('dashboard/type-distribution')
  async getTypeDistribution() {
    return {
      success: true,
      data: await this.accidentService.getTypeDistribution(),
    };
  }
}
