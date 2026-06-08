import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CompressionOptions {
  targetSizeMB?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface CompressionResult {
  originalPath: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

@Injectable()
export class ImageCompressionService {
  private readonly logger = new Logger(ImageCompressionService.name);
  private readonly DEFAULT_TARGET_SIZE_MB = 1.5;
  private readonly DEFAULT_MAX_WIDTH = 1920;
  private readonly DEFAULT_MAX_HEIGHT = 1080;
  private readonly DEFAULT_QUALITY = 0.8;

  async compressImage(
    inputPath: string,
    options: CompressionOptions = {},
  ): Promise<CompressionResult> {
    const {
      targetSizeMB = this.DEFAULT_TARGET_SIZE_MB,
      maxWidth = this.DEFAULT_MAX_WIDTH,
      maxHeight = this.DEFAULT_MAX_HEIGHT,
      quality = this.DEFAULT_QUALITY,
      format = 'jpeg',
    } = options;

    this.logger.log(`开始压缩图片: ${inputPath}, 目标大小: ${targetSizeMB}MB`);

    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;

    if (originalSize <= targetSizeMB * 1024 * 1024) {
      this.logger.log(`图片大小 ${(originalSize / 1024 / 1024).toFixed(2)}MB 小于目标大小，无需压缩`);
      return {
        originalPath: inputPath,
        compressedPath: inputPath,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        width: maxWidth,
        height: maxHeight,
      };
    }

    const tempDir = path.join(path.dirname(inputPath), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const ext = path.extname(inputPath);
    const basename = path.basename(inputPath, ext);
    const outputPath = path.join(tempDir, `${basename}_compressed.${format}`);

    try {
      const result = await this.tryCompress(
        inputPath,
        outputPath,
        maxWidth,
        maxHeight,
        quality,
        format,
        targetSizeMB,
      );

      return {
        originalPath: inputPath,
        compressedPath: outputPath,
        originalSize,
        compressedSize: result.size,
        compressionRatio: result.size / originalSize,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      this.logger.error(`图片压缩失败，使用原始图片: ${error.message}`);
      return {
        originalPath: inputPath,
        compressedPath: inputPath,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        width: maxWidth,
        height: maxHeight,
      };
    }
  }

  private async tryCompress(
    inputPath: string,
    outputPath: string,
    maxWidth: number,
    maxHeight: number,
    quality: number,
    format: string,
    targetSizeMB: number,
  ): Promise<{ size: number; width: number; height: number }> {
    let currentQuality = quality;
    let currentWidth = maxWidth;
    let currentHeight = maxHeight;
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        await this.compressWithSharp(
          inputPath,
          outputPath,
          currentWidth,
          currentHeight,
          currentQuality,
          format,
        );

        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          const sizeMB = stats.size / 1024 / 1024;

          this.logger.debug(`压缩尝试 ${attempt}: 质量=${currentQuality}, 尺寸=${currentWidth}x${currentHeight}, 大小=${sizeMB.toFixed(2)}MB`);

          if (sizeMB <= targetSizeMB || attempt >= maxAttempts) {
            return {
              size: stats.size,
              width: currentWidth,
              height: currentHeight,
            };
          }

          if (sizeMB > targetSizeMB * 2) {
            currentWidth = Math.floor(currentWidth * 0.7);
            currentHeight = Math.floor(currentHeight * 0.7);
          } else {
            currentQuality = Math.max(0.3, currentQuality - 0.15);
          }
        }
      } catch (error) {
        this.logger.warn(`压缩尝试 ${attempt} 失败: ${error.message}`);
        if (attempt >= maxAttempts) {
          throw error;
        }
        await this.delay(500);
      }
    }

    throw new Error('压缩失败，已达最大尝试次数');
  }

  private async compressWithSharp(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    quality: number,
    format: string,
  ): Promise<void> {
    try {
      const sharp = await import('sharp');
      await sharp.default(inputPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFormat(format as any, {
          quality: Math.round(quality * 100),
          progressive: true,
        })
        .toFile(outputPath);
    } catch (sharpError) {
      this.logger.warn(`sharp压缩失败，尝试使用ffmpeg: ${sharpError.message}`);
      await this.compressWithFFmpeg(inputPath, outputPath, width, height, quality, format);
    }
  }

  private async compressWithFFmpeg(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    quality: number,
    format: string,
  ): Promise<void> {
    const qualityValue = Math.round((1 - quality) * 31 + 1);
    const command = `ffmpeg -i "${inputPath}" -vf "scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease" -q:v ${qualityValue} -y "${outputPath}"`;

    try {
      await execAsync(command, { timeout: 30000 });
    } catch (ffmpegError) {
      this.logger.warn(`ffmpeg压缩失败，使用Node.js原生压缩: ${ffmpegError.message}`);
      await this.compressWithNode(inputPath, outputPath, width, height, quality);
    }
  }

  private async compressWithNode(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    quality: number,
  ): Promise<void> {
    try {
      const inputBuffer = fs.readFileSync(inputPath);
      const Jimp = await import('jimp');
      const image = await Jimp.default.read(inputBuffer);

      image
        .scaleToFit(width, height)
        .quality(Math.round(quality * 100))
        .write(outputPath);
    } catch (nodeError) {
      this.logger.warn(`Node.js压缩失败，复制原始文件: ${nodeError.message}`);
      fs.copyFileSync(inputPath, outputPath);
    }
  }

  async compressImageBuffer(
    buffer: Buffer,
    options: CompressionOptions = {},
  ): Promise<{ buffer: Buffer; size: number; width: number; height: number }> {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempInput = path.join(tempDir, `temp_${Date.now()}.jpg`);
    const tempOutput = path.join(tempDir, `temp_${Date.now()}_compressed.jpg`);

    fs.writeFileSync(tempInput, buffer);

    const result = await this.compressImage(tempInput, options);

    const outputBuffer = fs.readFileSync(result.compressedPath);

    setTimeout(() => {
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput) && tempOutput !== tempInput) fs.unlinkSync(tempOutput);
      } catch (e) {
        this.logger.debug('清理临时文件失败');
      }
    }, 60000);

    return {
      buffer: outputBuffer,
      size: result.compressedSize,
      width: result.width,
      height: result.height,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
