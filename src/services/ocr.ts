import Taro from '@tarojs/taro';
import type { PlateInfo, OcrResult } from '@/types/accident';

const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:3000/api';

export const recognizePlate = async (imagePath: string): Promise<OcrResult<PlateInfo>> => {
  console.log('[OCR] 开始识别车牌:', imagePath);
  
  const startTime = Date.now();
  
  try {
    Taro.showLoading({ title: '识别中...', mask: true });
    
    const result = await new Promise<OcrResult<PlateInfo>>((resolve) => {
      setTimeout(() => {
        const mockPlates = [
          { plateNo: '京A12345', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.98 },
          { plateNo: '京B67890', plateColor: 'yellow', vehicleType: '大型汽车', confidence: 0.95 },
          { plateNo: '沪C11111', plateColor: 'green', vehicleType: '新能源汽车', confidence: 0.92 },
          { plateNo: '粤D22222', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.96 }
        ];
        
        const randomPlate = mockPlates[Math.floor(Math.random() * mockPlates.length)];
        
        resolve({
          success: true,
          data: randomPlate,
          requestId: `req_${Date.now()}`
        });
      }, 1500);
    });
    
    const duration = Date.now() - startTime;
    console.log('[OCR] 车牌识别完成，耗时:', duration, 'ms，结果:', result);
    
    if (duration > 15000) {
      console.warn('[OCR] 识别耗时超过15秒，影响用户体验');
    }
    
    return result;
  } catch (error) {
    console.error('[OCR] 车牌识别失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '识别失败',
      requestId: `req_${Date.now()}`
    };
  } finally {
    Taro.hideLoading();
  }
};

export const recognizePlateByCloud = async (imagePath: string): Promise<OcrResult<PlateInfo>> => {
  console.log('[OCR] 调用云端OCR识别车牌');
  
  try {
    Taro.showLoading({ title: '识别中...', mask: true });
    
    const res = await Taro.uploadFile({
      url: `${API_BASE}/ocr/plate`,
      filePath: imagePath,
      name: 'image',
      header: {
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    const result = JSON.parse(res.data) as OcrResult<PlateInfo>;
    console.log('[OCR] 云端识别结果:', result);
    
    return result;
  } catch (error) {
    console.error('[OCR] 云端识别失败:', error);
    return {
      success: false,
      error: '识别服务暂不可用，请稍后重试',
      requestId: `req_${Date.now()}`
    };
  } finally {
    Taro.hideLoading();
  }
};
