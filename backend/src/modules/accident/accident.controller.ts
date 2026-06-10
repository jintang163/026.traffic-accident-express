import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseInterceptors, UploadedFile, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccidentService } from './accident.service';
import { CreateAccidentDto, DetermineLiabilityDto, SaveDraftDto, DeleteDraftDto, ReviewLiabilityDto } from './accident.dto';
import { PhotoEntity } from './photo.entity';
import { LiabilityRuleEngine } from './liability-rule-engine';
import { LiabilityRuleEntity } from './liability-rule.entity';

@Controller('accident')
export class AccidentController {
  constructor(
    private readonly accidentService: AccidentService,
    private readonly ruleEngine: LiabilityRuleEngine,
    @InjectRepository(PhotoEntity)
    private photoRepository: Repository<PhotoEntity>,
    @InjectRepository(LiabilityRuleEntity)
    private ruleRepository: Repository<LiabilityRuleEntity>,
  ) {}

  @Post('report')
  async create(@Body() dto: CreateAccidentDto, @Request() req) {
    const userId = req.user?.id;
    const accident = await this.accidentService.create(dto, userId);

    setTimeout(async () => {
      try {
        await this.accidentService.determineLiability(accident.id, { officer: '系统自动判定' });
        console.log('[AccidentController] 自动责任判定完成:', accident.id);
      } catch (error) {
        console.error('[AccidentController] 自动责任判定失败:', error);
      }
    }, 3000);

    return {
      success: true,
      data: accident,
      message: '报案提交成功',
    };
  }

  @Get('list')
  async findAll(@Query() query: { page?: number; pageSize?: number; status?: string; keyword?: string }, @Request() req) {
    const userId = req.user?.id;
    const result = await this.accidentService.findAll({
      ...query,
      userId,
    });

    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Get(':id/appeal-window')
  async getAppealWindow(@Param('id') id: string) {
    const accident = await this.accidentService.findOne(id);
    const window = this.accidentService.getAppealWindow(accident);
    return {
      success: true,
      data: window,
      message: window.canAppeal ? '可在申诉期内发起申诉' : '不可申诉',
    };
  }

  @Get('draft')
  async getDraft(@Request() req) {
    const userId = req.user?.id;
    const draft = await this.accidentService.getDraft(userId);

    return {
      success: true,
      data: draft,
      message: draft ? '草稿获取成功' : '无草稿',
    };
  }

  @Get('statistics')
  async getStatistics(@Request() req) {
    const userId = req.user?.id;
    const stats = await this.accidentService.getStatistics(userId);

    return {
      success: true,
      data: stats,
      message: '获取成功',
    };
  }

  @Get('review/list')
  async getReviewList(@Query() query: { page?: number; pageSize?: number }) {
    const result = await this.accidentService.getReviewList(query);

    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Post('draft')
  async saveDraft(@Body() dto: SaveDraftDto, @Request() req) {
    const userId = req.user?.id;
    const result = await this.accidentService.saveDraft(dto, userId);

    return {
      success: true,
      data: result,
      message: '草稿保存成功',
    };
  }

  @Post('draft/delete')
  async deleteDraft(@Body() dto: DeleteDraftDto, @Request() req) {
    const userId = req.user?.id;
    await this.accidentService.deleteDraft(dto.draftId, userId);

    return {
      success: true,
      data: null,
      message: '草稿删除成功',
    };
  }

  @Get('rules')
  async getRules() {
    const rules = await this.ruleEngine.getRuleList();

    return {
      success: true,
      data: rules,
      message: '获取成功',
    };
  }

  @Post('rules')
  async createRule(@Body() ruleData: Partial<LiabilityRuleEntity>) {
    const rule = await this.ruleEngine.createRule(ruleData);

    return {
      success: true,
      data: rule,
      message: '规则创建成功',
    };
  }

  @Put('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() ruleData: Partial<LiabilityRuleEntity>,
  ) {
    const rule = await this.ruleEngine.updateRule(id, ruleData);

    return {
      success: true,
      data: rule,
      message: '规则更新成功',
    };
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    await this.ruleEngine.deleteRule(id);

    return {
      success: true,
      data: null,
      message: '规则删除成功',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const accident = await this.accidentService.findOne(id);

    return {
      success: true,
      data: accident,
      message: '获取成功',
    };
  }

  @Post(':id/determine-liability')
  async determineLiability(
    @Param('id') id: string,
    @Body() dto: DetermineLiabilityDto,
  ) {
    const accident = await this.accidentService.determineLiability(id, dto);

    return {
      success: true,
      data: accident,
      message: '责任判定完成',
    };
  }

  @Post(':id/review')
  async reviewLiability(
    @Param('id') id: string,
    @Body() dto: ReviewLiabilityDto,
  ) {
    const accident = await this.accidentService.reviewLiability(id, dto);

    return {
      success: true,
      data: accident,
      message: '人工审核完成',
    };
  }

  @Post('upload-photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const filename = `${uuidv4()}${ext}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
      },
    }),
  )
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body('accidentId') accidentId: string,
    @Body('type') type: 'plate' | 'scene' = 'scene',
  ) {
    const baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}`;
    const relativePath = `/uploads/photos/${file.filename}`;
    const url = `${baseUrl}${relativePath}`;

    const photoData = {
      id: uuidv4(),
      accidentId: accidentId || null,
      type,
      url,
      thumbnailUrl: url,
      watermarkInfo: null,
      size: file.size,
      mimeType: file.mimetype,
      uploadTime: new Date(),
    };

    if (accidentId) {
      const photo = this.photoRepository.create(photoData);
      await this.photoRepository.save(photo);
    }

    return {
      success: true,
      data: photoData,
      message: '上传成功',
    };
  }
}
