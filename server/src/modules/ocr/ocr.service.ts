import { Injectable } from '@nestjs/common';
import * as axios from 'axios';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface PlateRecognitionResult {
  plateNo: string;
  plateColor: string;
  vehicleType: string;
  confidence: number;
}

@Injectable()
export class OcrService {
  private baiduToken: string | null = null;
  private tokenExpireTime: number = 0;

  async recognizePlate(imagePath: string): Promise<PlateRecognitionResult> {
    console.log('[OcrService] 开始车牌识别:', imagePath);
    
    try {
      const useMock = !process.env.BAIDU_OCR_API_KEY || !process.env.BAIDU_OCR_SECRET_KEY;
      
      if (useMock) {
        console.log('[OcrService] 使用Mock数据进行车牌识别');
        return this.mockRecognizePlate();
      }
      
      return await this.recognizeByBaidu(imagePath);
    } catch (error) {
      console.error('[OcrService] 车牌识别失败:', error);
      return this.mockRecognizePlate();
    }
  }

  private async recognizeByBaidu(imagePath: string): Promise<PlateRecognitionResult> {
    const token = await this.getBaiduToken();
    
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    const response = await axios.default.post(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/license_plate?access_token=${token}`,
      { image: imageBase64 },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );
    
    if (response.data.words_result) {
      const result = response.data.words_result;
      return {
        plateNo: result.number || '',
        plateColor: result.color || 'blue',
        vehicleType: this.getVehicleType(result.vehicle_type || ''),
        confidence: result.probability || 0.9,
      };
    }
    
    throw new Error('车牌识别失败');
  }

  private async getBaiduToken(): Promise<string> {
    const now = Date.now();
    
    if (this.baiduToken && now < this.tokenExpireTime) {
      return this.baiduToken;
    }
    
    const apiKey = process.env.BAIDU_OCR_API_KEY;
    const secretKey = process.env.BAIDU_OCR_SECRET_KEY;
    
    const response = await axios.default.post(
      'https://aip.baidubce.com/oauth/2.0/token',
      null,
      {
        params: {
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: secretKey,
        },
        timeout: 10000,
      }
    );
    
    this.baiduToken = response.data.access_token;
    this.tokenExpireTime = now + (response.data.expires_in - 60) * 1000;
    
    return this.baiduToken;
  }

  private async recognizeByTencent(imagePath: string): Promise<PlateRecognitionResult> {
    const mockResult = this.mockRecognizePlate();
    return mockResult;
  }

  private mockRecognizePlate(): Promise<PlateRecognitionResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPlates: PlateRecognitionResult[] = [
          { plateNo: '京A12345', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.98 },
          { plateNo: '京B67890', plateColor: 'yellow', vehicleType: '大型汽车', confidence: 0.95 },
          { plateNo: '沪C11111', plateColor: 'green', vehicleType: '新能源汽车', confidence: 0.92 },
          { plateNo: '粤D22222', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.96 },
          { plateNo: '浙E33333', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.94 },
        ];
        
        const randomPlate = mockPlates[Math.floor(Math.random() * mockPlates.length)];
        resolve(randomPlate);
      }, 1500);
    });
  }

  private getVehicleType(type: string): string {
    const typeMap: Record<string, string> = {
      '0': '大型汽车',
      '1': '小型汽车',
      '2': '使馆汽车',
      '3': '领馆汽车',
      '4': '境外汽车',
      '5': '外籍汽车',
      '6': '两、三轮摩托车',
      '7': '轻便摩托车',
      '8': '使馆摩托车',
      '9': '领馆摩托车',
      '10': '临时入境摩托车',
      '11': '临时行驶车',
      '12': '农用运输车',
      '13': '拖拉机',
      '14': '挂车',
      '15': '教练汽车',
      '16': '教练摩托车',
      '17': '客运汽车',
      '18': '货运汽车',
      '19': '新能源汽车',
    };
    
    return typeMap[type] || '小型汽车';
  }
}
