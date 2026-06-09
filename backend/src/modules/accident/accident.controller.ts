import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccidentService } from './accident.service';
import { CreateAccidentDto, DetermineLiabilityDto, SaveDraftDto, DeleteDraftDto } from './accident.dto';
import { PhotoEntity } from './photo.entity';

@Controller('accident')
export class AccidentController {
  constructor(
    private readonly accidentService: AccidentService,
    @InjectRepository(PhotoEntity)
    private photoRepository: Repository<PhotoEntity>,
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
  async findAll(@Query() query: { page?: number; pageSize?: number; status?: string }, @Request() req) {
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
