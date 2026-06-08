import type { AccidentInfo } from '@/types/accident';

export const mockAccidentList: AccidentInfo[] = [
  {
    id: 'acc_001',
    reportNo: 'BA202401150001',
    status: 'completed',
    occurTime: '2024-01-15T14:30:00.000Z',
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
      determinedAt: '2024-01-15T15:00:00.000Z',
      officer: '王警官'
    },
    createdAt: '2024-01-15T14:35:00.000Z',
    updatedAt: '2024-01-15T15:00:00.000Z'
  },
  {
    id: 'acc_002',
    reportNo: 'BA202401150002',
    status: 'processing',
    occurTime: '2024-01-15T09:20:00.000Z',
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
    createdAt: '2024-01-15T09:25:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z'
  },
  {
    id: 'acc_003',
    reportNo: 'BA202401150003',
    status: 'pending',
    occurTime: '2024-01-15T16:45:00.000Z',
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
    createdAt: '2024-01-15T16:50:00.000Z',
    updatedAt: '2024-01-15T16:50:00.000Z'
  }
];
