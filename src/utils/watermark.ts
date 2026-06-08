import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import type { WatermarkInfo } from '@/types/accident';

export const generateWatermarkInfo = (
  location: string,
  latitude: number,
  longitude: number
): WatermarkInfo => {
  return {
    timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    location,
    latitude,
    longitude
  };
};

export const addWatermarkToImage = async (
  imagePath: string,
  watermarkInfo: WatermarkInfo
): Promise<string> => {
  console.log('[Watermark] 开始添加水印:', imagePath);
  
  return new Promise((resolve, reject) => {
    const canvasId = 'watermarkCanvas';
    
    Taro.getImageInfo({
      src: imagePath,
      success: (imgInfo) => {
        const canvasWidth = imgInfo.width;
        const canvasHeight = imgInfo.height;
        
        const ctx = Taro.createCanvasContext(canvasId);
        
        ctx.drawImage(imagePath, 0, 0, canvasWidth, canvasHeight);
        
        const padding = 40;
        const fontSize = Math.max(24, canvasWidth / 30);
        const lineHeight = fontSize * 1.4;
        
        ctx.setFontSize(fontSize);
        ctx.setFillStyle('rgba(255, 255, 255, 0.9)');
        ctx.setTextAlign('left');
        
        ctx.fillRect(
          padding - 15,
          canvasHeight - padding - lineHeight * 3 - 15,
          canvasWidth - padding * 2 + 30,
          lineHeight * 3 + 30
        );
        
        ctx.setFillStyle('#333333');
        ctx.fillText(
          `时间: ${watermarkInfo.timestamp}`,
          padding,
          canvasHeight - padding - lineHeight * 2
        );
        ctx.fillText(
          `位置: ${watermarkInfo.location}`,
          padding,
          canvasHeight - padding - lineHeight
        );
        ctx.fillText(
          `坐标: ${watermarkInfo.latitude.toFixed(6)}, ${watermarkInfo.longitude.toFixed(6)}`,
          padding,
          canvasHeight - padding
        );
        
        ctx.draw(false, () => {
          setTimeout(() => {
            Taro.canvasToTempFilePath({
              canvasId,
              width: canvasWidth,
              height: canvasHeight,
              destWidth: canvasWidth,
              destHeight: canvasHeight,
              fileType: 'jpg',
              quality: 0.9,
              success: (res) => {
                console.log('[Watermark] 水印添加成功:', res.tempFilePath);
                resolve(res.tempFilePath);
              },
              fail: (err) => {
                console.error('[Watermark] 画布导出失败:', err);
                reject(err);
              }
            });
          }, 300);
        });
      },
      fail: (err) => {
        console.error('[Watermark] 获取图片信息失败:', err);
        reject(err);
      }
    });
  });
};

export const generateThumbnail = async (
  imagePath: string,
  maxWidth: number = 300
): Promise<string> => {
  console.log('[Watermark] 生成缩略图:', imagePath);
  
  return new Promise((resolve, reject) => {
    Taro.getImageInfo({
      src: imagePath,
      success: (imgInfo) => {
        const ratio = imgInfo.height / imgInfo.width;
        const width = maxWidth;
        const height = maxWidth * ratio;
        
        const canvasId = 'thumbnailCanvas';
        const ctx = Taro.createCanvasContext(canvasId);
        
        ctx.drawImage(imagePath, 0, 0, width, height);
        
        ctx.draw(false, () => {
          setTimeout(() => {
            Taro.canvasToTempFilePath({
              canvasId,
              width,
              height,
              destWidth: width,
              destHeight: height,
              fileType: 'jpg',
              quality: 0.8,
              success: (res) => {
                console.log('[Watermark] 缩略图生成成功:', res.tempFilePath);
                resolve(res.tempFilePath);
              },
              fail: (err) => {
                console.error('[Watermark] 缩略图生成失败:', err);
                reject(err);
              }
            });
          }, 200);
        });
      },
      fail: (err) => {
        console.error('[Watermark] 获取图片信息失败:', err);
        reject(err);
      }
    });
  });
};
