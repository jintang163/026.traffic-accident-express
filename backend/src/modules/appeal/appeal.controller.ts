import { Controller, Post, Get, Put, Param, Body, Query, Request } from '@nestjs/common';
import { AppealService } from './appeal.service';
import { CreateAppealDto, ReviewAppealDto } from './appeal.dto';
import { AppealStatus } from './appeal.entity';

@Controller('appeal')
export class AppealController {
  constructor(private readonly appealService: AppealService) {}

  @Post('create')
  async create(@Body() dto: CreateAppealDto, @Request() req) {
    const userId = req.user?.id;
    const appeal = await this.appealService.create(dto, userId);
    return {
      success: true,
      data: appeal,
      message: '申诉提交成功，请等待人工复核',
    };
  }

  @Get('list')
  async findAll(
    @Query() query: { page?: number; pageSize?: number; status?: AppealStatus; accidentId?: string },
    @Request() req,
  ) {
    const userId = req.user?.id;
    const result = await this.appealService.findAll({ ...query, userId });
    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Get('statistics')
  async statistics(@Request() req) {
    const userId = req.user?.id;
    return {
      success: true,
      data: await this.appealService.getStatistics(userId),
    };
  }

  @Get('by-accident/:accidentId')
  async findByAccident(@Param('accidentId') accidentId: string, @Request() req) {
    const userId = req.user?.id;
    const appeal = await this.appealService.findByAccidentId(accidentId, userId);
    return {
      success: true,
      data: appeal,
      message: appeal ? '已找到申诉记录' : '该事故暂无申诉',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const appeal = await this.appealService.findOne(id);
    return {
      success: true,
      data: appeal,
      message: '获取成功',
    };
  }

  @Put(':id/review')
  async review(@Param('id') id: string, @Body() dto: ReviewAppealDto) {
    const appeal = await this.appealService.review(id, dto);
    return {
      success: true,
      data: appeal,
      message: '申诉审核完成',
    };
  }

  @Put(':id/withdraw')
  async withdraw(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id;
    const appeal = await this.appealService.withdraw(id, userId);
    return {
      success: true,
      data: appeal,
      message: '申诉已撤回',
    };
  }
}
