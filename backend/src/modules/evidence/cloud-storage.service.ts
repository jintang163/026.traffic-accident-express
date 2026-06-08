import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export type CloudProvider = 'tencent_cos' | 'aliyun_oss' | 'local';

export interface UploadOptions {
  provider?: CloudProvider;
  bucket?: string;
  region?: string;
  acl?: 'public-read' | 'private';
  folder?: string;
}

export interface UploadResult {
  url: string;
  cdnUrl: string;
  etag: string;
  size: number;
  provider: CloudProvider;
  bucket: string;
  key: string;
}

export interface ChunkUploadSession {
  sessionId: string;
  fileId: string;
  fileName: string;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  uploadedChunks: number[];
  provider: CloudProvider;
  bucket: string;
  key: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);
  private readonly sessions = new Map<string, ChunkUploadSession>();
  private readonly DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024;

  private getDefaultProvider(): CloudProvider {
    if (process.env.TENCENT_COS_SECRET_ID) return 'tencent_cos';
    if (process.env.ALIYUN_OSS_ACCESS_KEY_ID) return 'aliyun_oss';
    return 'local';
  }

  async uploadFile(
    filePath: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const {
      provider = this.getDefaultProvider(),
      bucket = this.getDefaultBucket(provider),
      region = this.getDefaultRegion(provider),
      acl = 'public-read',
      folder = this.getDefaultFolder(),
    } = options;

    this.logger.log(`开始上传文件: ${filePath}, 存储提供商: ${provider}`);

    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName);
    const key = `${folder}/${Date.now()}_${uuidv4().substring(0, 8)}${fileExtension}`;

    try {
      if (provider === 'tencent_cos') {
        return await this.uploadToTencentCOS(filePath, bucket, region, key, acl);
      } else if (provider === 'aliyun_oss') {
        return await this.uploadToAliyunOSS(filePath, bucket, region, key, acl);
      } else {
        return await this.uploadToLocal(filePath, key);
      }
    } catch (error) {
      this.logger.warn(`云存储上传失败，使用本地存储: ${error.message}`);
      return await this.uploadToLocal(filePath, key);
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `${uuidv4()}_${fileName}`);
    fs.writeFileSync(tempPath, buffer);

    try {
      const result = await this.uploadFile(tempPath, options);

      setTimeout(() => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (e) {
          this.logger.debug('清理临时文件失败');
        }
      }, 60000);

      return result;
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  async initChunkUpload(
    fileName: string,
    totalSize: number,
    options: UploadOptions = {},
  ): Promise<ChunkUploadSession> {
    const {
      provider = this.getDefaultProvider(),
      bucket = this.getDefaultBucket(provider),
      folder = this.getDefaultFolder(),
    } = options;

    const fileExtension = path.extname(fileName);
    const key = `${folder}/${Date.now()}_${uuidv4().substring(0, 8)}${fileExtension}`;

    const chunkSize = this.DEFAULT_CHUNK_SIZE;
    const totalChunks = Math.ceil(totalSize / chunkSize);

    const session: ChunkUploadSession = {
      sessionId: uuidv4(),
      fileId: uuidv4(),
      fileName,
      totalChunks,
      chunkSize,
      totalSize,
      uploadedChunks: [],
      provider,
      bucket,
      key,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    this.sessions.set(session.sessionId, session);

    this.logger.log(`分片上传会话已创建: ${session.sessionId}, 总分片数: ${totalChunks}`);

    return session;
  }

  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer,
  ): Promise<{ success: boolean; uploadedChunks: number[]; progress: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('上传会话不存在或已过期');
    }

    if (session.uploadedChunks.includes(chunkIndex)) {
      return {
        success: true,
        uploadedChunks: session.uploadedChunks,
        progress: (session.uploadedChunks.length / session.totalChunks) * 100,
      };
    }

    const tempDir = path.join(process.cwd(), 'uploads', 'chunks', sessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    fs.writeFileSync(chunkPath, chunkData);

    session.uploadedChunks.push(chunkIndex);
    session.uploadedChunks.sort((a, b) => a - b);

    const progress = (session.uploadedChunks.length / session.totalChunks) * 100;

    this.logger.debug(`分片 ${chunkIndex} 上传完成，进度: ${progress.toFixed(2)}%`);

    if (session.uploadedChunks.length === session.totalChunks) {
      setTimeout(() => this.mergeChunks(sessionId), 100);
    }

    return {
      success: true,
      uploadedChunks: session.uploadedChunks,
      progress,
    };
  }

  private async mergeChunks(sessionId: string): Promise<UploadResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('上传会话不存在或已过期');
    }

    this.logger.log(`开始合并分片: ${sessionId}`);

    const tempDir = path.join(process.cwd(), 'uploads', 'chunks', sessionId);
    const mergedPath = path.join(process.cwd(), 'uploads', 'temp', `${sessionId}_merged`);

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

    const result = await this.uploadFile(mergedPath, {
      provider: session.provider,
      bucket: session.bucket,
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(mergedPath);

    this.sessions.delete(sessionId);

    this.logger.log(`分片合并完成: ${result.url}`);

    return result;
  }

  async getUploadProgress(sessionId: string): Promise<{ uploadedChunks: number[]; progress: number; isComplete: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('上传会话不存在或已过期');
    }

    return {
      uploadedChunks: session.uploadedChunks,
      progress: (session.uploadedChunks.length / session.totalChunks) * 100,
      isComplete: session.uploadedChunks.length === session.totalChunks,
    };
  }

  async checkNetworkSpeed(): Promise<{ downloadSpeed: number; uploadSpeed: number; latency: number }> {
    const startTime = Date.now();

    try {
      const testFileUrl = process.env.SPEED_TEST_URL || 'https://speed.hetzner.de/1MB.bin';
      const response = await axios.get(testFileUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      const downloadTime = Date.now() - startTime;
      const fileSize = response.data.byteLength;
      const downloadSpeed = (fileSize / 1024 / 1024) / (downloadTime / 1000);

      const uploadStartTime = Date.now();
      const testBuffer = Buffer.alloc(100 * 1024);
      const uploadResult = await this.uploadBuffer(testBuffer, 'speed_test.bin', { provider: 'local' });
      const uploadTime = Date.now() - uploadStartTime;
      const uploadSpeed = (testBuffer.length / 1024 / 1024) / (uploadTime / 1000);

      await this.deleteFile(uploadResult.key, { provider: 'local' });

      return {
        downloadSpeed: Math.round(downloadSpeed * 100) / 100,
        uploadSpeed: Math.round(uploadSpeed * 100) / 100,
        latency: Math.round(downloadTime / 2),
      };
    } catch (error) {
      this.logger.warn(`网速检测失败: ${error.message}`);
      return {
        downloadSpeed: 0,
        uploadSpeed: 0,
        latency: 999,
      };
    }
  }

  async deleteFile(key: string, options: UploadOptions = {}): Promise<boolean> {
    const { provider = this.getDefaultProvider() } = options;

    try {
      if (provider === 'local') {
        const filePath = path.join(process.cwd(), 'uploads', key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return true;
    } catch (error) {
      this.logger.error(`删除文件失败: ${error.message}`);
      return false;
    }
  }

  private async uploadToTencentCOS(
    filePath: string,
    bucket: string,
    region: string,
    key: string,
    acl: string,
  ): Promise<UploadResult> {
    try {
      const COS = await import('cos-nodejs-sdk-v5');
      const cos = new COS.default({
        SecretId: process.env.TENCENT_COS_SECRET_ID,
        SecretKey: process.env.TENCENT_COS_SECRET_KEY,
        Region: region,
      });

      const fileBuffer = fs.readFileSync(filePath);

      const result = await cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: fileBuffer,
        ACL: acl,
      });

      return {
        url: `https://${bucket}.cos.${region}.myqcloud.com/${key}`,
        cdnUrl: process.env.TENCENT_COS_CDN_DOMAIN
          ? `https://${process.env.TENCENT_COS_CDN_DOMAIN}/${key}`
          : `https://${bucket}.cos.${region}.myqcloud.com/${key}`,
        etag: result.ETag,
        size: fileBuffer.length,
        provider: 'tencent_cos',
        bucket,
        key,
      };
    } catch (error) {
      this.logger.error(`腾讯云COS上传失败: ${error.message}`);
      throw error;
    }
  }

  private async uploadToAliyunOSS(
    filePath: string,
    bucket: string,
    region: string,
    key: string,
    acl: string,
  ): Promise<UploadResult> {
    try {
      const OSS = await import('ali-oss');
      const client = new OSS.default({
        region: `oss-${region}`,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket,
      });

      const result = await client.put(key, filePath, {
        headers: {
          'x-oss-object-acl': acl,
        },
      });

      const stats = fs.statSync(filePath);

      return {
        url: result.url,
        cdnUrl: process.env.ALIYUN_OSS_CDN_DOMAIN
          ? `https://${process.env.ALIYUN_OSS_CDN_DOMAIN}/${key}`
          : result.url,
        etag: result.res.headers.etag,
        size: stats.size,
        provider: 'aliyun_oss',
        bucket,
        key,
      };
    } catch (error) {
      this.logger.error(`阿里云OSS上传失败: ${error.message}`);
      throw error;
    }
  }

  private async uploadToLocal(filePath: string, key: string): Promise<UploadResult> {
    const targetDir = path.join(process.cwd(), 'uploads', path.dirname(key));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(process.cwd(), 'uploads', key);

    if (filePath !== targetPath) {
      fs.copyFileSync(filePath, targetPath);
    }

    const stats = fs.statSync(targetPath);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    return {
      url: `${baseUrl}/uploads/${key}`,
      cdnUrl: `${baseUrl}/uploads/${key}`,
      etag: uuidv4(),
      size: stats.size,
      provider: 'local',
      bucket: 'local',
      key,
    };
  }

  private getDefaultBucket(provider: CloudProvider): string {
    if (provider === 'tencent_cos') return process.env.TENCENT_COS_BUCKET || 'traffic-accident';
    if (provider === 'aliyun_oss') return process.env.ALIYUN_OSS_BUCKET || 'traffic-accident';
    return 'local';
  }

  private getDefaultRegion(provider: CloudProvider): string {
    if (provider === 'tencent_cos') return process.env.TENCENT_COS_REGION || 'ap-beijing';
    if (provider === 'aliyun_oss') return process.env.ALIYUN_OSS_REGION || 'beijing';
    return 'local';
  }

  private getDefaultFolder(): string {
    const date = new Date();
    return `photos/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  }
}
