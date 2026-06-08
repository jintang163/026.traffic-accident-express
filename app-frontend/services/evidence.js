const request = require('../utils/request.js');

const MAX_PHOTOS_PER_ACCIDENT = 8;
const CHUNK_SIZE = 1 * 1024 * 1024;
const MAX_RETRY_COUNT = 3;
const WEAK_NETWORK_THRESHOLD = 0.5;
const UPLOAD_TIMEOUT = 30000;

class EvidenceService {
  constructor() {
    this.uploadingSessions = new Map();
    this.retryQueue = [];
    this.isProcessingRetry = false;
  }

  async checkNetworkSpeed() {
    try {
      const res = await request.get('/evidence/network-speed', {
        timeout: 15000,
      });
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 网速检测失败:', error);
      return {
        downloadSpeed: 0,
        uploadSpeed: 0,
        latency: 999,
        isWeakNetwork: true,
      };
    }
  }

  async getPhotoCount(accidentId) {
    try {
      const res = await request.get(`/evidence/photo-count/${accidentId}`);
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 获取照片数量失败:', error);
      return { count: 0, max: MAX_PHOTOS_PER_ACCIDENT };
    }
  }

  async compressImage(tempFilePath, options = {}) {
    const {
      targetSizeMB = 1.5,
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 80,
    } = options;

    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath: tempFilePath,
        success: (info) => {
          const sizeMB = info.size / 1024 / 1024;

          if (sizeMB <= targetSizeMB) {
            console.log(`[EvidenceService] 图片大小 ${sizeMB.toFixed(2)}MB 小于目标大小，无需压缩`);
            resolve({
              tempFilePath,
              compressedPath: tempFilePath,
              originalSize: info.size,
              compressedSize: info.size,
              compressionRatio: 1,
            });
            return;
          }

          let currentQuality = quality;
          let currentWidth = maxWidth;
          let currentHeight = maxHeight;
          let attempt = 0;
          const maxAttempts = 5;

          const tryCompress = () => {
            attempt++;
            console.log(`[EvidenceService] 压缩尝试 ${attempt}: 质量=${currentQuality}, 尺寸=${currentWidth}x${currentHeight}`);

            wx.compressImage({
              src: tempFilePath,
              quality: currentQuality,
              compressedWidth: currentWidth,
              compressedHeight: currentHeight,
              success: (compressRes) => {
                wx.getFileInfo({
                  filePath: compressRes.tempFilePath,
                  success: (compressedInfo) => {
                    const compressedSizeMB = compressedInfo.size / 1024 / 1024;
                    console.log(`[EvidenceService] 压缩结果: ${compressedSizeMB.toFixed(2)}MB`);

                    if (compressedSizeMB <= targetSizeMB || attempt >= maxAttempts) {
                      resolve({
                        tempFilePath,
                        compressedPath: compressRes.tempFilePath,
                        originalSize: info.size,
                        compressedSize: compressedInfo.size,
                        compressionRatio: compressedInfo.size / info.size,
                      });
                    } else {
                      if (compressedSizeMB > targetSizeMB * 2) {
                        currentWidth = Math.floor(currentWidth * 0.7);
                        currentHeight = Math.floor(currentHeight * 0.7);
                      } else {
                        currentQuality = Math.max(30, currentQuality - 15);
                      }
                      tryCompress();
                    }
                  },
                  fail: () => {
                    resolve({
                      tempFilePath,
                      compressedPath: tempFilePath,
                      originalSize: info.size,
                      compressedSize: info.size,
                      compressionRatio: 1,
                    });
                  },
                });
              },
              fail: () => {
                if (attempt < maxAttempts) {
                  currentQuality = Math.max(30, currentQuality - 15);
                  tryCompress();
                } else {
                  resolve({
                    tempFilePath,
                    compressedPath: tempFilePath,
                    originalSize: info.size,
                    compressedSize: info.size,
                    compressionRatio: 1,
                  });
                }
              },
            });
          };

          tryCompress();
        },
        fail: () => {
          resolve({
            tempFilePath,
            compressedPath: tempFilePath,
            originalSize: 0,
            compressedSize: 0,
            compressionRatio: 1,
          });
        },
      });
    });
  }

  async initChunkUpload(fileName, totalSize, accidentId, photoSubType = 'other') {
    try {
      const res = await request.post('/evidence/chunk/init', {
        fileName,
        totalSize,
        accidentId,
        photoSubType,
      });
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 初始化分片上传失败:', error);
      throw error;
    }
  }

  async uploadChunk(sessionId, chunkIndex, chunkData, md5Hash, onProgress) {
    return new Promise((resolve, reject) => {
      const uploadTask = wx.uploadFile({
        url: `${request.defaults.baseURL}/evidence/chunk/upload`,
        filePath: chunkData,
        name: 'chunk',
        formData: {
          sessionId,
          chunkIndex,
          md5Hash: md5Hash || '',
        },
        header: {
          Authorization: wx.getStorageSync('token') ? `Bearer ${wx.getStorageSync('token')}` : '',
        },
        timeout: UPLOAD_TIMEOUT,
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              resolve(data.data);
            } else {
              reject(new Error(data.message || '分片上传失败'));
            }
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        },
        fail: (error) => {
          reject(error);
        },
      });

      if (onProgress) {
        uploadTask.onProgressUpdate((res) => {
          onProgress(res.progress);
        });
      }
    });
  }

  async getChunkProgress(sessionId) {
    try {
      const res = await request.get(`/evidence/chunk/progress/${sessionId}`);
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 获取上传进度失败:', error);
      throw error;
    }
  }

  async completeChunkUpload(sessionId, accidentId, gpsInfo, deviceInfo, watermarkInfo) {
    try {
      const res = await request.post('/evidence/chunk/complete', {
        sessionId,
        accidentId,
        gpsInfo,
        deviceInfo,
        watermarkInfo,
      });
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 完成分片上传失败:', error);
      throw error;
    }
  }

  async uploadEvidencePhoto(tempFilePath, options = {}) {
    const {
      accidentId,
      photoSubType = 'other',
      gpsInfo,
      deviceInfo,
      watermarkInfo,
      onProgress,
      autoRetry = true,
    } = options;

    console.log('[EvidenceService] 开始上传证据照片:', tempFilePath);

    try {
      const networkInfo = await this.checkNetworkSpeed();
      console.log('[EvidenceService] 网络状态:', networkInfo);

      const compressResult = await this.compressImage(tempFilePath, {
        targetSizeMB: 1.5,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      console.log('[EvidenceService] 图片压缩完成:', compressResult);

      const fileInfo = await new Promise((resolve, reject) => {
        wx.getFileInfo({
          filePath: compressResult.compressedPath,
          success: resolve,
          fail: reject,
        });
      });

      const fileName = `photo_${Date.now()}.jpg`;
      const fileSize = fileInfo.size;

      const initResult = await this.initChunkUpload(fileName, fileSize, accidentId, photoSubType);
      console.log('[EvidenceService] 分片上传初始化:', initResult);

      const sessionId = initResult.sessionId;
      const totalChunks = initResult.totalChunks;
      const chunkSize = initResult.chunkSize;

      const fileBuffer = await this.readFileAsBuffer(compressResult.compressedPath);

      const uploadedChunks = [];
      const retryDelay = networkInfo.isWeakNetwork ? 3000 : 1000;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunkData = fileBuffer.slice(start, end);

        const chunkFilePath = await this.saveChunkToTemp(chunkData, sessionId, i);

        let retryCount = 0;
        let uploadSuccess = false;

        while (!uploadSuccess && retryCount < MAX_RETRY_COUNT) {
          try {
            const chunkMd5 = this.calculateMD5(chunkData);

            const result = await this.uploadChunk(
              sessionId,
              i,
              chunkFilePath,
              chunkMd5,
              (progress) => {
                if (onProgress) {
                  const totalProgress = ((i + progress / 100) / totalChunks) * 100;
                  onProgress(Math.min(totalProgress, 99));
                }
              }
            );

            uploadedChunks.push(i);
            uploadSuccess = true;
            console.log(`[EvidenceService] 分片 ${i + 1}/${totalChunks} 上传成功`);

            wx.removeSavedFile({
              filePath: chunkFilePath,
              fail: () => {},
            });
          } catch (error) {
            retryCount++;
            console.warn(`[EvidenceService] 分片 ${i + 1} 上传失败，重试 ${retryCount}/${MAX_RETRY_COUNT}:`, error);

            if (retryCount < MAX_RETRY_COUNT && autoRetry) {
              await this.delay(retryDelay * retryCount);
            } else {
              wx.removeSavedFile({
                filePath: chunkFilePath,
                fail: () => {},
              });
              throw new Error(`分片 ${i + 1} 上传失败，已达最大重试次数`);
            }
          }
        }
      }

      if (onProgress) {
        onProgress(100);
      }

      console.log('[EvidenceService] 所有分片上传完成，开始合并...');

      const finalResult = await this.completeChunkUpload(
        sessionId,
        accidentId,
        gpsInfo,
        deviceInfo,
        watermarkInfo
      );

      console.log('[EvidenceService] 证据上传完成:', finalResult.evidenceId);

      return finalResult;
    } catch (error) {
      console.error('[EvidenceService] 证据上传失败:', error);
      throw error;
    }
  }

  async uploadMultiplePhotos(tempFilePaths, options = {}) {
    const {
      accidentId,
      onPhotoProgress,
      onOverallProgress,
    } = options;

    const results = [];
    const total = tempFilePaths.length;

    const photoCount = await this.getPhotoCount(accidentId);
    const remainingSlots = photoCount.max - photoCount.count;

    if (tempFilePaths.length > remainingSlots) {
      throw new Error(`最多还能上传 ${remainingSlots} 张照片`);
    }

    const deviceInfo = this.getDeviceInfo();

    for (let i = 0; i < tempFilePaths.length; i++) {
      const tempFilePath = tempFilePaths[i];

      try {
        const result = await this.uploadEvidencePhoto(tempFilePath, {
          accidentId,
          photoSubType: i === 0 ? 'plate_closeup' : i === 1 ? 'scene_panorama' : 'collision_detail',
          deviceInfo,
          onProgress: (progress) => {
            if (onPhotoProgress) {
              onPhotoProgress(i, progress);
            }
            if (onOverallProgress) {
              const overallProgress = ((i + progress / 100) / total) * 100;
              onOverallProgress(overallProgress);
            }
          },
        });

        results.push({
          index: i,
          success: true,
          data: result,
        });
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  async verifyEvidence(evidenceId) {
    try {
      const res = await request.post('/evidence/verify', {
        evidenceId,
      });
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 证据核验失败:', error);
      throw error;
    }
  }

  async getEvidenceList(query = {}) {
    try {
      const res = await request.get('/evidence/list', query);
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 获取证据列表失败:', error);
      throw error;
    }
  }

  async getEvidenceDetail(id) {
    try {
      const res = await request.get(`/evidence/${id}`);
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 获取证据详情失败:', error);
      throw error;
    }
  }

  async getStatistics(accidentId) {
    try {
      const params = accidentId ? { accidentId } : {};
      const res = await request.get('/evidence/statistics/summary', params);
      return res.data;
    } catch (error) {
      console.error('[EvidenceService] 获取统计信息失败:', error);
      throw error;
    }
  }

  private async readFileAsBuffer(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath,
        success: (res) => resolve(res.data),
        fail: reject,
      });
    });
  }

  private async saveChunkToTemp(buffer, sessionId, chunkIndex) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      const tempFilePath = `${wx.env.USER_DATA_PATH}/chunks/${sessionId}_${chunkIndex}.bin`;

      fs.mkdirSync(`${wx.env.USER_DATA_PATH}/chunks`, true);

      fs.writeFile({
        filePath: tempFilePath,
        data: buffer,
        encoding: 'binary',
        success: () => resolve(tempFilePath),
        fail: reject,
      });
    });
  }

  private calculateMD5(buffer) {
    const hex_chars = '0123456789abcdef';
    let hash = 0;

    for (let i = 0; i < buffer.length; i++) {
      hash = ((hash << 5) - hash + buffer[i]) | 0;
    }

    let hex = '';
    for (let i = 0; i < 16; i++) {
      hex += hex_chars[(hash >> (i * 4)) & 0x0f];
    }

    return hex;
  }

  private getDeviceInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      return {
        deviceModel: systemInfo.model,
        osVersion: systemInfo.system,
        platform: systemInfo.platform,
        sdkVersion: systemInfo.SDKVersion,
        appVersion: '1.0.0',
        deviceId: systemInfo.deviceId || '',
      };
    } catch (error) {
      return {};
    }
  }

  private delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const evidenceService = new EvidenceService();

module.exports = evidenceService;
module.exports.EvidenceService = EvidenceService;
module.exports.MAX_PHOTOS_PER_ACCIDENT = MAX_PHOTOS_PER_ACCIDENT;
module.exports.WEAK_NETWORK_THRESHOLD = WEAK_NETWORK_THRESHOLD;
