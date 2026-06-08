import Taro from '@tarojs/taro';
import type { LocationInfo } from '@/types/accident';

export const getCurrentLocation = async (): Promise<LocationInfo> => {
  console.log('[Location] 获取当前位置...');
  
  try {
    const res = await Taro.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000
    });
    
    console.log('[Location] 位置获取成功:', res.latitude, res.longitude);
    
    const address = await reverseGeocode(res.latitude, res.longitude);
    
    return {
      latitude: res.latitude,
      longitude: res.longitude,
      address: address.address,
      province: address.province,
      city: address.city,
      district: address.district
    };
  } catch (error) {
    console.error('[Location] 位置获取失败:', error);
    Taro.showToast({
      title: '定位失败，请检查定位设置',
      icon: 'none'
    });
    throw error;
  }
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<{ address: string; province: string; city: string; district: string }> => {
  console.log('[Location] 逆地理编码:', latitude, longitude);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        address: '北京市朝阳区建国路88号',
        province: '北京市',
        city: '北京市',
        district: '朝阳区'
      });
    }, 500);
  });
};

export const formatLocation = (location: LocationInfo): string => {
  return `${location.province}${location.city}${location.district}${location.address}`;
};
