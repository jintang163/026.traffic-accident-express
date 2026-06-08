import Taro from '@tarojs/taro';
import type { ElectronicCertificate } from '@/types/certificate';

const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:3000/api';

export const getCertificateList = async (params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ list: ElectronicCertificate[]; total: number }> => {
  console.log('[Certificate] 获取认定书列表:', params);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockList = generateMockCertificates();
      resolve({
        list: mockList,
        total: mockList.length
      });
    }, 800);
  });
};

export const getCertificateDetail = async (id: string): Promise<ElectronicCertificate> => {
  console.log('[Certificate] 获取认定书详情:', id);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockList = generateMockCertificates();
      const certificate = mockList.find(item => item.id === id) || mockList[0];
      resolve(certificate);
    }, 600);
  });
};

export const generateCertificate = async (accidentId: string): Promise<ElectronicCertificate> => {
  console.log('[Certificate] 生成认定书:', accidentId);
  
  try {
    Taro.showLoading({ title: '生成中...', mask: true });
    
    const res = await Taro.request({
      url: `${API_BASE}/certificate/generate`,
      method: 'POST',
      data: { accidentId },
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    console.log('[Certificate] 认定书生成成功:', res.data);
    return res.data.data as ElectronicCertificate;
  } catch (error) {
    console.error('[Certificate] 认定书生成失败:', error);
    throw error;
  } finally {
    Taro.hideLoading();
  }
};

export const downloadCertificate = async (certificateId: string): Promise<string> => {
  console.log('[Certificate] 下载认定书:', certificateId);
  
  try {
    Taro.showLoading({ title: '下载中...', mask: true });
    
    const res = await Taro.request({
      url: `${API_BASE}/certificate/${certificateId}/download`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    console.log('[Certificate] 认定书下载成功');
    return res.data.data.url;
  } catch (error) {
    console.error('[Certificate] 认定书下载失败:', error);
    Taro.showToast({ title: '下载失败', icon: 'none' });
    throw error;
  } finally {
    Taro.hideLoading();
  }
};

export const shareCertificate = async (certificateId: string): Promise<{ shareUrl: string; verifyCode: string }> => {
  console.log('[Certificate] 分享认定书:', certificateId);
  
  try {
    const res = await Taro.request({
      url: `${API_BASE}/certificate/${certificateId}/share`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Taro.getStorageSync('token') || ''}`
      }
    });
    
    console.log('[Certificate] 认定书分享链接生成成功');
    return res.data.data;
  } catch (error) {
    console.error('[Certificate] 认定书分享失败:', error);
    throw error;
  }
};

export const verifyCertificate = async (certificateNo: string, verifyCode: string): Promise<boolean> => {
  console.log('[Certificate] 核验认定书:', certificateNo, verifyCode);
  
  try {
    const res = await Taro.request({
      url: `${API_BASE}/certificate/verify`,
      method: 'POST',
      data: { certificateNo, verifyCode },
      header: {
        'Content-Type': 'application/json'
      }
    });
    
    return res.data.data.valid as boolean;
  } catch (error) {
    console.error('[Certificate] 认定书核验失败:', error);
    return false;
  }
};

const generateMockCertificates = (): ElectronicCertificate[] => {
  const now = new Date();
  return [
    {
      id: 'cert_001',
      certificateNo: 'RD202401150001',
      accidentId: 'acc_001',
      accidentInfo: {
        reportNo: 'BA202401150001',
        occurTime: new Date(now.getTime() - 86400000 * 2).toISOString(),
        location: '北京市朝阳区建国路88号',
        accidentType: 'rear_end',
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
        ]
      },
      liabilityResult: {
        primaryParty: '京B67890',
        secondaryParty: '京A12345',
        primaryLiability: 100,
        secondaryLiability: 0,
        liabilityDescription: '后车未保持安全车距，负全部责任',
        determinedAt: new Date(now.getTime() - 86400000).toISOString(),
        officer: '王警官'
      },
      parties: [
        {
          id: 'p1',
          name: '张三',
          idCardNo: '110101199001011234',
          phone: '13800138001',
          plateNo: '京A12345',
          insuranceCompany: '中国平安',
          liability: 'none'
        },
        {
          id: 'p2',
          name: '李四',
          idCardNo: '110101199002025678',
          phone: '13800138002',
          plateNo: '京B67890',
          insuranceCompany: '中国人保',
          liability: 'full'
        }
      ],
      certificateContent: `道路交通事故认定书（简易程序）
      
第 RD202401150001 号

事故时间：${new Date(now.getTime() - 86400000 * 2).toLocaleString()}
事故地点：北京市朝阳区建国路88号

当事人：
甲方：张三，驾驶京A12345号小型轿车
乙方：李四，驾驶京B67890号小型轿车

交通事故事实：
2024年01月15日14时30分，李四驾驶京B67890号小型轿车沿建国路由东向西行驶至上述地点时，该车前部与前方同车道行驶的张三驾驶的京A12345号小型轿车后部相撞，造成两车损坏。

责任认定：
根据《中华人民共和国道路交通安全法》第四十三条之规定，当事人李四驾驶机动车未与前车保持足以采取紧急制动措施的安全距离，是造成此事故的全部原因，应负此事故的全部责任；当事人张三无责任。

损害赔偿调解结果：
1. 京B67890号车辆损失由李四承担；
2. 京A12345号车辆损失由李四承担；
3. 此事故一次性解决，各方签字后生效。

当事人签字：__________  __________
办案民警：王警官
公安机关交通管理部门（盖章）
2024年01月15日`,
      status: 'issued',
      issuedAt: new Date(now.getTime() - 86400000).toISOString(),
      issuedBy: '北京市公安局公安交通管理局朝阳交通支队',
      validUntil: new Date(now.getTime() + 86400000 * 365 * 5).toISOString(),
      verifyCode: 'VERIFY20240115001',
      pdfUrl: 'https://example.com/certificates/cert_001.pdf'
    },
    {
      id: 'cert_002',
      certificateNo: 'RD202401150002',
      accidentId: 'acc_002',
      accidentInfo: {
        reportNo: 'BA202401150002',
        occurTime: new Date(now.getTime() - 3600000 * 5).toISOString(),
        location: '北京市海淀区中关村大街1号',
        accidentType: 'side_swipe',
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
        ]
      },
      liabilityResult: {
        primaryParty: '沪C11111',
        secondaryParty: '粤D22222',
        primaryLiability: 70,
        secondaryLiability: 30,
        liabilityDescription: '变道车辆未观察相邻车道情况，负主要责任；另一方未保持安全车距，负次要责任',
        determinedAt: new Date(now.getTime() - 3600000 * 2).toISOString(),
        officer: '李警官'
      },
      parties: [
        {
          id: 'p3',
          name: '王五',
          idCardNo: '310101199003039012',
          phone: '13800138003',
          plateNo: '沪C11111',
          insuranceCompany: '太平洋保险',
          liability: 'primary'
        },
        {
          id: 'p4',
          name: '赵六',
          idCardNo: '440101199004043456',
          phone: '13800138004',
          plateNo: '粤D22222',
          insuranceCompany: '中国人寿',
          liability: 'secondary'
        }
      ],
      certificateContent: `道路交通事故认定书（简易程序）
      
第 RD202401150002 号

...`,
      status: 'issued',
      issuedAt: new Date(now.getTime() - 3600000 * 2).toISOString(),
      issuedBy: '北京市公安局公安交通管理局海淀交通支队',
      validUntil: new Date(now.getTime() + 86400000 * 365 * 5).toISOString(),
      verifyCode: 'VERIFY20240115002'
    }
  ];
};
