import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile, Request, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { EvidenceService } from './evidence.service';
import { CloudStorageService, ChunkUploadSession } from './cloud-storage.service';
import {
  CreateEvidenceDto,
  QueryEvidenceDto,
  VerifyEvidenceDto,
  UpdateEvidenceStatusDto,
  ChunkUploadInitDto,
  ChunkUploadDto,
  CompleteChunkUploadDto,
  NetworkSpeedTestResult,
} from './evidence.dto';
import { EvidenceEntity } from './evidence.entity';

@Controller('evidence')
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly cloudStorageService: CloudStorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'evidence');
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
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateEvidenceDto,
    @Request() req,
  ) {
    dto.fileName = dto.fileName || file.originalname;
    dto.fileSize = file.size;
    dto.mimeType = file.mimetype;
    dto.fileFormat = path.extname(file.originalname).slice(1);

    const evidence = await this.evidenceService.create(dto, file);

    return {
      success: true,
      data: evidence,
      message: '证据上传成功',
    };
  }

  @Post('chunk/init')
  async initChunkUpload(@Body() dto: ChunkUploadInitDto) {
    const photoCount = await this.evidenceService.getPhotoCount(dto.accidentId || '');
    if (dto.accidentId && photoCount.count >= photoCount.max) {
      throw new BadRequestException(`每起事故最多上传${photoCount.max}张照片，当前已有${photoCount.count}张`);
    }

    const session: ChunkUploadSession = await this.cloudStorageService.initChunkUpload(
      dto.fileName,
      dto.totalSize,
    );

    return {
      success: true,
      data: {
        sessionId: session.sessionId,
        fileId: session.fileId,
        totalChunks: session.totalChunks,
        chunkSize: session.chunkSize,
        maxPhotos: photoCount.max,
        currentPhotos: photoCount.count,
      },
      message: '分片上传初始化成功',
    };
  }

  @Post('chunk/upload')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const sessionId = req.body.sessionId;
          const uploadDir = path.join(process.cwd(), 'uploads', 'chunks', sessionId);
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const chunkIndex = req.body.chunkIndex;
          cb(null, `chunk_${chunkIndex}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async uploadChunk(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ChunkUploadDto,
  ) {
    const chunkBuffer = fs.readFileSync(file.path);

    if (dto.md5Hash) {
      const crypto = require('crypto');
      const actualMd5 = crypto.createHash('md5').update(chunkBuffer).digest('hex');
      if (actualMd5 !== dto.md5Hash) {
        fs.unlinkSync(file.path);
        throw new BadRequestException('分片数据校验失败，请重新上传');
      }
    }

    const result = await this.cloudStorageService.uploadChunk(
      dto.sessionId,
      dto.chunkIndex,
      chunkBuffer,
    );

    fs.unlinkSync(file.path);

    return {
      success: true,
      data: result,
      message: '分片上传成功',
    };
  }

  @Get('chunk/progress/:sessionId')
  async getChunkProgress(@Param('sessionId') sessionId: string) {
    const result = await this.cloudStorageService.getUploadProgress(sessionId);

    return {
      success: true,
      data: result,
      message: '获取进度成功',
    };
  }

  @Post('chunk/complete')
  async completeChunkUpload(@Body() dto: CompleteChunkUploadDto) {
    const progress = await this.cloudStorageService.getUploadProgress(dto.sessionId);

    if (!progress.isComplete) {
      throw new BadRequestException('分片未全部上传完成');
    }

    const session = (this.cloudStorageService as any).sessions.get(dto.sessionId);
    if (!session) {
      throw new BadRequestException('上传会话不存在或已过期');
    }

    const tempDir = path.join(process.cwd(), 'uploads', 'chunks', dto.sessionId);
    const mergedPath = path.join(process.cwd(), 'uploads', 'temp', `${dto.sessionId}_merged.jpg`);

    if (!fs.existsSync(path.dirname(mergedPath))) {
      fs.mkdirSync(path.dirname(mergedPath), { recursive: true });
    }

    const writeStream = fs.createWriteStream(mergedPath);
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk_${i}`);
      const chunkBuffer = fs.readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
    }
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const mergedBuffer = fs.readFileSync(mergedPath);

    const evidenceDto: CreateEvidenceDto = {
      accidentId: dto.accidentId,
      originalUrl: '',
      fileName: session.fileName,
      fileSize: session.totalSize,
      gpsInfo: dto.gpsInfo,
      deviceInfo: dto.deviceInfo,
      watermarkInfo: dto.watermarkInfo,
    };

    const fakeFile = {
      buffer: mergedBuffer,
      originalname: session.fileName,
      size: session.totalSize,
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const evidence = await this.evidenceService.create(evidenceDto, fakeFile);

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(mergedPath);

    (this.cloudStorageService as any).sessions.delete(dto.sessionId);

    return {
      success: true,
      data: evidence,
      message: '分片合并完成，证据上传成功',
    };
  }

  @Get('network-speed')
  async checkNetworkSpeed() {
    const speedInfo = await this.cloudStorageService.checkNetworkSpeed();

    const isWeakNetwork = speedInfo.uploadSpeed < 0.5 || speedInfo.latency > 500;

    const result: NetworkSpeedTestResult = {
      downloadSpeed: speedInfo.downloadSpeed,
      uploadSpeed: speedInfo.uploadSpeed,
      latency: speedInfo.latency,
      isWeakNetwork,
    };

    return {
      success: true,
      data: result,
      message: '网速检测完成',
    };
  }

  @Get('list')
  async findAll(@Query() query: QueryEvidenceDto) {
    const result = await this.evidenceService.findAll(query);

    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const evidence = await this.evidenceService.findOne(id);

    return {
      success: true,
      data: evidence,
      message: '获取成功',
    };
  }

  @Get('evidence-id/:evidenceId')
  async findByEvidenceId(@Param('evidenceId') evidenceId: string) {
    const evidence = await this.evidenceService.findByEvidenceId(evidenceId);

    return {
      success: true,
      data: evidence,
      message: '获取成功',
    };
  }

  @Post('verify')
  async verifyEvidence(@Body() dto: VerifyEvidenceDto) {
    const result = await this.evidenceService.verifyEvidence(dto.evidenceId);

    return {
      success: true,
      data: result,
      message: result.isValid ? '证据核验通过' : '证据已被篡改',
    };
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEvidenceStatusDto,
  ) {
    const evidence = await this.evidenceService.updateStatus(id, dto);

    return {
      success: true,
      data: evidence,
      message: '状态更新成功',
    };
  }

  @Get('statistics/summary')
  async getStatistics(@Query('accidentId') accidentId?: string) {
    const result = await this.evidenceService.getStatistics(accidentId);

    return {
      success: true,
      data: result,
      message: '获取统计成功',
    };
  }

  @Get('photo-count/:accidentId')
  async getPhotoCount(@Param('accidentId') accidentId: string) {
    const result = await this.evidenceService.getPhotoCount(accidentId);

    return {
      success: true,
      data: result,
      message: '获取成功',
    };
  }

  @Post('check-expired')
  async checkExpired() {
    const count = await this.evidenceService.checkAndUpdateExpired();

    return {
      success: true,
      data: { updatedCount: count },
      message: `已检查并更新 ${count} 条过期证据`,
    };
  }
}
