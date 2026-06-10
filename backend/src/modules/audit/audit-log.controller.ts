import { Controller, Get, Query, Param } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('list')
  async findAll(
    @Query() query: { page?: number; pageSize?: number; action?: string; accidentId?: string; operatorId?: string; startDate?: string; endDate?: string },
  ) {
    const result = await this.auditLogService.findAll(query);
    return { success: true, data: result, message: '获取成功' };
  }

  @Get('by-accident/:accidentId')
  async findByAccident(@Param('accidentId') accidentId: string) {
    const list = await this.auditLogService.findByAccidentId(accidentId);
    return { success: true, data: list, message: '获取成功' };
  }

  @Get('recent')
  async getRecent(@Query('count') count?: number) {
    const list = await this.auditLogService.getRecent(count || 20);
    return { success: true, data: list, message: '获取成功' };
  }

  @Get('action-stats')
  async getActionStats(@Query('days') days?: number) {
    const data = await this.auditLogService.getActionStats(days || 30);
    return { success: true, data, message: '获取成功' };
  }
}
