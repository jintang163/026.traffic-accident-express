import Taro from '@tarojs/taro';
import type { AccidentInfo, PhotoInfo, VehicleInfo } from '@/types/accident';

const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:3000/api';

export const submitAccidentReport = async (data: {
  vehicles: VehicleInfo[];
  scenePhotos: PhotoInfo[];
  accidentType: string;
  description: string;
  weather: string;
  roadCondition: string;
  location: string;
  latitude: number;
  longitude: number;
}): Promise<AccidentInfo> => {
  console.log('[Accident] 提交事故报案:', data);
  
  try {
    Taro.showLoading({ title: '提交中...', mask: true });
    
    const res = await Taro.request({
      url: `${API_BASE}/accident/report`,
      method: 'POST',
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    console.log('[Accident] 报案提交成功:', res.data);
    return res.data.data as AccidentInfo;
  } catch (error) {
    console.error('[Accident] 报案提交失败:', error);
    throw error;
  } finally {
    Taro.hideLoading();
  }
};

export const getAccidentList = async (params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ list: AccidentInfo[]; total: number }> => {
  console.log('[Accident] 获取事故列表:', params);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockList = generateMockAccidentList();
      resolve({
        list: mockList,
        total: mockList.length
      });
    }, 800);
  });
};

export const getAccidentDetail = async (id: string): Promise<AccidentInfo> => {
  console.log('[Accident] 获取事故详情:', id);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockList = generateMockAccidentList();
      const accident = mockList.find(item => item.id === id) || mockList[0];
      resolve(accident);
    }, 600);
  });
};

export const uploadPhoto = async (
  imagePath: string,
  type: 'plate' | 'scene'
): Promise<PhotoInfo> => {
  console.log('[Accident] 上传照片:', imagePath, type);
  
  try {
    const res = await Taro.uploadFile({
      url: `${API_BASE}/accident/photo/upload`,
      filePath: imagePath,
      name: 'file',
      formData: { type },
      header: {
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    const result = JSON.parse(res.data);
    console.log('[Accident] 照片上传成功:', result);
    return result.data as PhotoInfo;
  } catch (error) {
    console.error('[Accident] 照片上传失败:', error);
    
    return {
      id: `photo_${Date.now()}`,
      url: imagePath,
      thumbnailUrl: imagePath,
      type,
      watermarkInfo: {
        timestamp: new Date().toISOString(),
        location: '北京市朝阳区',
        latitude: 39.9042,
        longitude: 116.4074
      },
      uploadTime: new Date().toISOString()
    };
  }
};

export const determineLiability = async (accidentId: string): Promise<AccidentInfo> => {
  console.log('[Accident] 申请责任判定:', accidentId);
  
  try {
    const res = await Taro.request({
      url: `${API_BASE}/accident/${accidentId}/determine-liability`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    console.log('[Accident] 责任判定完成:', res.data);
    return res.data.data as AccidentInfo;
  } catch (error) {
    console.error('[Accident] 责任判定失败:', error);
    throw error;
  }
};

const generateMockAccidentList = (): AccidentInfo[] => {
  const now = new Date();
  return [
    {
      id: 'acc_001',
      reportNo: 'BA202401150001',
      status: 'completed',
      occurTime: new Date(now.getTime() - 86400000 * 2).toISOString(),
      location: '北京市朝阳区建国路88号',
      latitude: 39.9042,
      longitude: 116.4074,
      vehicles: [
        {
          id: 'v1',
          plateInfo: { plateNo: '京A12345', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.98 },
          platePhoto: null,
          ownerName: '张三',
          ownerPhone: '13800138001',
          insuranceCompany: '中国平安'
        },
        {
          id: 'v2',
          plateInfo: { plateNo: '京B67890', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.96 },
          platePhoto: null,
          ownerName: '李四',
          ownerPhone: '13800138002',
          insuranceCompany: '中国人保'
        }
      ],
      scenePhotos: [],
      accidentType: 'rear_end',
      description: '车辆在正常行驶中被后车追尾',
      weather: '晴',
      roadCondition: '干燥',
      liabilityResult: {
        primaryParty: '京B67890',
        secondaryParty: '京A12345',
        primaryLiability: 100,
        secondaryLiability: 0,
        liabilityDescription: '后车未保持安全车距，负全部责任',
        determinedAt: new Date(now.getTime() - 86400000).toISOString(),
        officer: '王警官'
      },
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000).toISOString()
    },
    {
      id: 'acc_002',
      reportNo: 'BA202401150002',
      status: 'processing',
      occurTime: new Date(now.getTime() - 3600000 * 5).toISOString(),
      location: '北京市海淀区中关村大街1号',
      latitude: 39.9842,
      longitude: 116.3074,
      vehicles: [
        {
          id: 'v3',
          plateInfo: { plateNo: '沪C11111', plateColor: 'green', vehicleType: '新能源汽车', confidence: 0.95 },
          platePhoto: null,
          ownerName: '王五',
          ownerPhone: '13800138003',
          insuranceCompany: '太平洋保险'
        },
        {
          id: 'v4',
          plateInfo: { plateNo: '粤D22222', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.97 },
          platePhoto: null,
          ownerName: '赵六',
          ownerPhone: '13800138004',
          insuranceCompany: '中国人寿'
        }
      ],
      scenePhotos: [],
      accidentType: 'side_swipe',
      description: '变道时与相邻车道车辆发生剐蹭',
      weather: '阴',
      roadCondition: '干燥',
      createdAt: new Date(now.getTime() - 3600000 * 5).toISOString(),
      updatedAt: new Date(now.getTime() - 3600000 * 3).toISOString()
    },
    {
      id: 'acc_003',
      reportNo: 'BA202401150003',
      status: 'pending',
      occurTime: new Date(now.getTime() - 3600000).toISOString(),
      location: '北京市西城区金融街3号',
      latitude: 39.9142,
      longitude: 116.3574,
      vehicles: [
        {
          id: 'v5',
          plateInfo: { plateNo: '京E33333', plateColor: 'blue', vehicleType: '小型汽车', confidence: 0.94 },
          platePhoto: null,
          ownerName: '孙七',
          ownerPhone: '13800138005',
          insuranceCompany: '中国太平'
        },
        {
          id: 'v6',
          plateInfo: { plateNo: '京F44444', plateColor: 'yellow', vehicleType: '大型汽车', confidence: 0.93 },
          platePhoto: null,
          ownerName: '周八',
          ownerPhone: '13800138006',
          insuranceCompany: '阳光保险'
        }
      ],
      scenePhotos: [],
      accidentType: 'reverse',
      description: '倒车时与后方车辆发生碰撞',
      weather: '小雨',
      roadCondition: '湿滑',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      updatedAt: new Date(now.getTime() - 3600000).toISOString()
    }
  ];
};
