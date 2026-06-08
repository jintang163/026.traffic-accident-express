import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AccidentService } from './accident.service';
import { CreateAccidentDto, DetermineLiabilityDto } from './accident.dto';
import { PhotoEntity } from './photo.entity';

@Controller('accident')
export class AccidentController {
  constructor(private readonly accidentService: AccidentService) {}

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

  @Post('photo/upload')
  @UseInterceptors(
    FileInterceptor('file', {
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
    @Body('type') type: 'plate' | 'scene' = 'scene',
  ) {
    const baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}`;
    const relativePath = `/uploads/photos/${file.filename}`;
    const url = `${baseUrl}${relativePath}`;
    
    const photo: PhotoEntity = {
      id: uuidv4(),
      accidentId: null,
      accident: null,
      type,
      url,
      thumbnailUrl: url,
      watermarkInfo: null,
      size: file.size,
      mimeType: file.mimetype,
      uploadTime: new Date(),
    };
    
    return {
      success: true,
      data: photo,
      message: '上传成功',
    };
  }
}
