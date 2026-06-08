import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256';

export type ChainProvider = 'antchain' | 'notary' | 'mock';

export interface HashResult {
  md5: string;
  sha1: string;
  sha256: string;
}

export interface ChainResult {
  success: boolean;
  txId: string;
  blockHeight?: string;
  proof?: string;
  timestamp: Date;
  provider: ChainProvider;
  error?: string;
}

export interface VerifyResult {
  isValid: boolean;
  currentHash: string;
  storedHash: string;
  chainInfo?: {
    txId: string;
    blockHeight: string;
    timestamp: Date;
    isOnChain: boolean;
  };
}

@Injectable()
export class HashAndChainService {
  private readonly logger = new Logger(HashAndChainService.name);
  private readonly EVIDENCE_VALIDITY_YEARS = 2;

  async calculateFileHash(filePath: string): Promise<HashResult> {
    this.logger.log(`开始计算文件哈希: ${filePath}`);

    return new Promise((resolve, reject) => {
      const md5 = crypto.createHash('md5');
      const sha1 = crypto.createHash('sha1');
      const sha256 = crypto.createHash('sha256');

      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => {
        md5.update(chunk);
        sha1.update(chunk);
        sha256.update(chunk);
      });

      stream.on('end', () => {
        const result = {
          md5: md5.digest('hex'),
          sha1: sha1.digest('hex'),
          sha256: sha256.digest('hex'),
        };
        this.logger.debug(`文件哈希计算完成: MD5=${result.md5.substring(0, 16)}...`);
        resolve(result);
      });

      stream.on('error', (error) => {
        this.logger.error(`文件哈希计算失败: ${error.message}`);
        reject(error);
      });
    });
  }

  async calculateBufferHash(buffer: Buffer): Promise<HashResult> {
    this.logger.log(`开始计算Buffer哈希，大小: ${buffer.length} bytes`);

    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    this.logger.debug(`Buffer哈希计算完成: MD5=${md5.substring(0, 16)}...`);

    return { md5, sha1, sha256 };
  }

  async uploadToChain(
    hash: string,
    metadata: Record<string, any> = {},
    provider?: ChainProvider,
  ): Promise<ChainResult> {
    const chainProvider = provider || this.getDefaultChainProvider();

    this.logger.log(`开始区块链存证，哈希: ${hash.substring(0, 16)}..., 提供商: ${chainProvider}`);

    try {
      if (chainProvider === 'antchain') {
        return await this.uploadToAntChain(hash, metadata);
      } else if (chainProvider === 'notary') {
        return await this.uploadToNotary(hash, metadata);
      } else {
        return await this.mockChainUpload(hash, metadata);
      }
    } catch (error) {
      this.logger.warn(`区块链存证失败，使用Mock存证: ${error.message}`);
      return await this.mockChainUpload(hash, metadata);
    }
  }

  async verifyEvidence(
    filePath: string,
    storedHash: string,
    storedHashAlgorithm: HashAlgorithm = 'sha256',
    chainInfo?: {
      txId: string;
      blockHeight: string;
      timestamp: Date;
      provider: ChainProvider;
    },
  ): Promise<VerifyResult> {
    this.logger.log(`开始核验证据: ${filePath}`);

    const currentHashResult = await this.calculateFileHash(filePath);
    const currentHash = currentHashResult[storedHashAlgorithm];

    const isValid = currentHash === storedHash;

    if (!isValid) {
      this.logger.warn(`证据核验失败，哈希不匹配`);
    }

    let chainVerifyResult: { isOnChain: boolean } = { isOnChain: false };

    if (chainInfo) {
      try {
        chainVerifyResult = await this.verifyChain(
          chainInfo.txId,
          chainInfo.provider,
        );
      } catch (error) {
        this.logger.warn(`区块链核验失败: ${error.message}`);
      }
    }

    return {
      isValid,
      currentHash,
      storedHash,
      chainInfo: chainInfo
        ? {
            txId: chainInfo.txId,
            blockHeight: chainInfo.blockHeight,
            timestamp: chainInfo.timestamp,
            isOnChain: chainVerifyResult.isOnChain,
          }
        : undefined,
    };
  }

  async verifyBuffer(
    buffer: Buffer,
    storedHash: string,
    storedHashAlgorithm: HashAlgorithm = 'sha256',
  ): Promise<{ isValid: boolean; currentHash: string; storedHash: string }> {
    const currentHashResult = await this.calculateBufferHash(buffer);
    const currentHash = currentHashResult[storedHashAlgorithm];

    return {
      isValid: currentHash === storedHash,
      currentHash,
      storedHash,
    };
  }

  calculateExpireDate(uploadDate: Date = new Date()): Date {
    const expireDate = new Date(uploadDate);
    expireDate.setFullYear(expireDate.getFullYear() + this.EVIDENCE_VALIDITY_YEARS);
    return expireDate;
  }

  isExpired(expireDate: Date): boolean {
    return new Date() > expireDate;
  }

  generateEvidenceId(): string {
    return `EVID${Date.now()}${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  generateEvidenceHash(metadata: {
    accidentId: string;
    photoId: string;
    fileHash: string;
    uploadTime: Date;
    gpsInfo?: any;
    deviceInfo?: any;
  }): string {
    const evidenceData = JSON.stringify({
      accidentId: metadata.accidentId,
      photoId: metadata.photoId,
      fileHash: metadata.fileHash,
      uploadTime: metadata.uploadTime.toISOString(),
      gpsInfo: metadata.gpsInfo,
      deviceInfo: metadata.deviceInfo,
      nonce: uuidv4(),
    });

    return crypto.createHash('sha256').update(evidenceData).digest('hex');
  }

  private getDefaultChainProvider(): ChainProvider {
    if (process.env.ANTCHAIN_ENDPOINT) return 'antchain';
    if (process.env.NOTARY_API_URL) return 'notary';
    return 'mock';
  }

  private async uploadToAntChain(
    hash: string,
    metadata: Record<string, any>,
  ): Promise<ChainResult> {
    try {
      const endpoint = process.env.ANTCHAIN_ENDPOINT;
      const accessKeyId = process.env.ANTCHAIN_ACCESS_KEY_ID;
      const accessKeySecret = process.env.ANTCHAIN_ACCESS_KEY_SECRET;

      if (!endpoint || !accessKeyId || !accessKeySecret) {
        throw new Error('蚂蚁链配置不完整');
      }

      const timestamp = Date.now();
      const signature = this.generateAntChainSignature(
        accessKeySecret,
        hash,
        timestamp,
      );

      const response = await axios.post(
        `${endpoint}/api/chain/notarize`,
        {
          hash,
          metadata,
          timestamp,
          accessKeyId,
          signature,
        },
        { timeout: 15000 },
      );

      if (response.data.success) {
        return {
          success: true,
          txId: response.data.txId,
          blockHeight: response.data.blockHeight,
          proof: response.data.proof,
          timestamp: new Date(),
          provider: 'antchain',
        };
      } else {
        throw new Error(response.data.message || '蚂蚁链存证失败');
      }
    } catch (error) {
      this.logger.error(`蚂蚁链存证失败: ${error.message}`);
      throw error;
    }
  }

  private async uploadToNotary(
    hash: string,
    metadata: Record<string, any>,
  ): Promise<ChainResult> {
    try {
      const apiUrl = process.env.NOTARY_API_URL;
      const apiKey = process.env.NOTARY_API_KEY;

      if (!apiUrl || !apiKey) {
        throw new Error('公证处API配置不完整');
      }

      const response = await axios.post(
        `${apiUrl}/api/v1/notarize`,
        {
          hash,
          metadata,
          evidenceType: 'traffic_accident_photo',
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      if (response.data.code === 0) {
        return {
          success: true,
          txId: response.data.data.notaryId,
          blockHeight: response.data.data.serialNo,
          proof: response.data.data.certificateUrl,
          timestamp: new Date(),
          provider: 'notary',
        };
      } else {
        throw new Error(response.data.message || '公证处存证失败');
      }
    } catch (error) {
      this.logger.error(`公证处存证失败: ${error.message}`);
      throw error;
    }
  }

  private async mockChainUpload(
    hash: string,
    metadata: Record<string, any>,
  ): Promise<ChainResult> {
    this.logger.log(`使用Mock区块链存证，哈希: ${hash.substring(0, 16)}...`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const mockTxId = `0x${crypto.createHash('sha256').update(hash + Date.now()).digest('hex').substring(0, 64)}`;
    const mockBlockHeight = `BLOCK${Math.floor(Math.random() * 1000000).toString().padStart(8, '0')}`;
    const mockProof = `MOCK_PROOF_${uuidv4().toUpperCase()}`;

    return {
      success: true,
      txId: mockTxId,
      blockHeight: mockBlockHeight,
      proof: mockProof,
      timestamp: new Date(),
      provider: 'mock',
    };
  }

  private async verifyChain(
    txId: string,
    provider: ChainProvider,
  ): Promise<{ isOnChain: boolean; txInfo?: any }> {
    try {
      if (provider === 'antchain') {
        return await this.verifyAntChain(txId);
      } else if (provider === 'notary') {
        return await this.verifyNotary(txId);
      } else {
        return { isOnChain: true };
      }
    } catch (error) {
      this.logger.warn(`区块链核验失败: ${error.message}`);
      return { isOnChain: false };
    }
  }

  private async verifyAntChain(txId: string): Promise<{ isOnChain: boolean; txInfo?: any }> {
    try {
      const endpoint = process.env.ANTCHAIN_ENDPOINT;
      const accessKeyId = process.env.ANTCHAIN_ACCESS_KEY_ID;
      const accessKeySecret = process.env.ANTCHAIN_ACCESS_KEY_SECRET;

      const timestamp = Date.now();
      const signature = this.generateAntChainSignature(
        accessKeySecret,
        txId,
        timestamp,
      );

      const response = await axios.post(
        `${endpoint}/api/chain/verify`,
        {
          txId,
          timestamp,
          accessKeyId,
          signature,
        },
        { timeout: 10000 },
      );

      return {
        isOnChain: response.data.success && response.data.data?.confirmed,
        txInfo: response.data.data,
      };
    } catch (error) {
      throw error;
    }
  }

  private async verifyNotary(txId: string): Promise<{ isOnChain: boolean; txInfo?: any }> {
    try {
      const apiUrl = process.env.NOTARY_API_URL;
      const apiKey = process.env.NOTARY_API_KEY;

      const response = await axios.get(
        `${apiUrl}/api/v1/notarize/${txId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 10000,
        },
      );

      return {
        isOnChain: response.data.code === 0 && response.data.data?.status === 'confirmed',
        txInfo: response.data.data,
      };
    } catch (error) {
      throw error;
    }
  }

  private generateAntChainSignature(
    secret: string,
    hash: string,
    timestamp: number,
  ): string {
    const signString = `hash=${hash}&timestamp=${timestamp}&secret=${secret}`;
    return crypto.createHash('sha256').update(signString).digest('hex');
  }
}
