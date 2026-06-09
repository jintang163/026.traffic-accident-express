import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('plate')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'ocr');
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
  async recognizePlate(@UploadedFile() file: Express.Multer.File) {
    console.log('[OcrController] 收到车牌识别请求:', file.originalname, file.size);
    
    const startTime = Date.now();
    
    try {
      const result = await this.ocrService.recognizePlate(file.path);
      
      const duration = Date.now() - startTime;
      console.log('[OcrController] 车牌识别完成，耗时:', duration, 'ms');
      
      if (duration > 15000) {
        console.warn('[OcrController] 识别耗时超过15秒，影响用户体验');
      }
      
      return {
        success: true,
        data: result,
        requestId: `req_${Date.now()}`,
      };
    } catch (error) {
      console.error('[OcrController] 车牌识别失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '识别失败',
        requestId: `req_${Date.now()}`,
      };
    }
  }

  @Post('plate-url')
  async recognizePlateByUrl(@Body('imageUrl') imageUrl: string) {
    console.log('[OcrController] 收到URL车牌识别请求:', imageUrl);
    
    const startTime = Date.now();
    
    try {
      const result = await this.ocrService.recognizePlateByUrl(imageUrl);
      
      const duration = Date.now() - startTime;
      console.log('[OcrController] URL车牌识别完成，耗时:', duration, 'ms');
      
      return {
        success: true,
        data: result,
        requestId: `req_${Date.now()}`,
      };
    } catch (error) {
      console.error('[OcrController] URL车牌识别失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '识别失败',
        requestId: `req_${Date.now()}`,
      };
    }
  }
}
