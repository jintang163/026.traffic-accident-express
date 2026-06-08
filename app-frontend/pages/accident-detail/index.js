const { getAccidentDetail } = require('../../services/accident');

const accidentTypeMap = {
  rear_end: '追尾事故',
  side_swipe: '变道刮擦',
  head_on: '正面碰撞',
  reverse: '倒车事故',
  intersection: '路口事故',
  other: '其他事故'
};

const weatherMap = {
  sunny: '晴天',
  rainy: '雨天',
  cloudy: '阴天',
  foggy: '雾天',
  snowy: '雪天'
};

const roadConditionMap = {
  dry: '干燥',
  wet: '湿滑',
  icy: '结冰',
  oily: '油污'
};

const statusMap = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  cancelled: '已取消'
};

Page({
  data: {
    accidentId: '',
    accident: null,
    loading: false,
    previewPhoto: '',
    showPreview: false,
    timeline: []
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ accidentId: options.id });
      this.loadDetail();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  onPullDownRefresh: function () {
    this.loadDetail();
    wx.stopPullDownRefresh();
  },

  loadDetail: function () {
    this.setData({ loading: true });
    
    getAccidentDetail(this.data.accidentId).then((res) => {
      const accident = res.data || res;
      const timeline = this.buildTimeline(accident);
      
      this.setData({
        accident: this.formatAccidentData(accident),
        timeline,
        loading: false
      });
    }).catch((err) => {
      console.error('[AccidentDetail] 加载失败:', err);
      const mockData = this.getMockDetail();
      this.setData({
        accident: mockData,
        timeline: this.buildTimeline(mockData),
        loading: false
      });
    });
  },

  formatAccidentData: function (accident) {
    return {
      ...accident,
      accidentTypeText: accidentTypeMap[accident.accidentType] || accident.accidentType,
      weatherText: weatherMap[accident.weather] || accident.weather,
      roadConditionText: roadConditionMap[accident.roadCondition] || accident.roadCondition,
      statusText: statusMap[accident.status] || accident.status
    };
  },

  buildTimeline: function (accident) {
    const timeline = [];
    
    if (accident.createdAt) {
      timeline.push({
        time: accident.createdAt,
        title: '报案提交',
        description: '事故报案已提交，等待处理',
        status: 'done'
      });
    }
    
    if (accident.photos && accident.photos.length > 0) {
      timeline.push({
        time: accident.createdAt,
        title: '照片上传',
        description: `已上传${accident.photos.length}张现场照片`,
        status: 'done'
      });
    }
    
    if (accident.liability) {
      timeline.push({
        time: accident.liability.determinedAt || accident.createdAt,
        title: '责任认定',
        description: accident.liability.description || '责任认定已完成',
        status: 'done'
      });
    }
    
    if (accident.certificateId || accident.certificate) {
      timeline.push({
        time: accident.certificate?.createdAt || accident.createdAt,
        title: '认定书生成',
        description: `认定书编号：${accident.certificate?.certificateNumber || '已生成'}`,
        status: 'done'
      });
    }
    
    if (accident.status === 'completed') {
      timeline.push({
        time: accident.updatedAt || accident.createdAt,
        title: '处理完成',
        description: '事故已处理完成',
        status: 'done'
      });
    }
    
    return timeline;
  },

  getMockDetail: function () {
    return this.formatAccidentData({
      id: '1',
      accidentNumber: 'SG202606080001',
      accidentType: 'rear_end',
      accidentTime: '2026-06-08 10:30:00',
      location: '北京市朝阳区建国路88号',
      latitude: 39.9087,
      longitude: 116.4074,
      description: '后车未保持安全车距，追尾前车，造成后车前脸受损，前车后保险杠凹陷。',
      weather: 'sunny',
      roadCondition: 'dry',
      status: 'completed',
      createdAt: '2026-06-08 10:32:00',
      updatedAt: '2026-06-08 10:45:00',
      vehicles: [
        {
          id: 'v1',
          plateNumber: '京A12345',
          plateColor: '蓝色',
          vehicleType: '小型轿车',
          ownerName: '张三',
          ownerPhone: '138****8888',
          damage: '后保险杠凹陷，尾灯破裂',
          photo: ''
        },
        {
          id: 'v2',
          plateNumber: '京B67890',
          plateColor: '蓝色',
          vehicleType: '小型轿车',
          ownerName: '李四',
          ownerPhone: '139****9999',
          damage: '前脸受损，格栅破裂',
          photo: ''
        }
      ],
      photos: [
        { id: 'p1', url: '', type: 'scene', thumb: '' },
        { id: 'p2', url: '', type: 'scene', thumb: '' },
        { id: 'p3', url: '', type: 'plate', thumb: '' }
      ],
      liability: {
        primaryParty: '李四（后车）',
        primaryRatio: 100,
        secondaryParty: '张三（前车）',
        secondaryRatio: 0,
        description: '后车未保持安全车距，负全部责任',
        determinedAt: '2026-06-08 10:35:00'
      },
      certificate: {
        id: 'c1',
        certificateNumber: 'RD202606080001',
        createdAt: '2026-06-08 10:40:00'
      },
      driverA: { name: '张三', phone: '138****8888', licenseNumber: '110***********1234' },
      driverB: { name: '李四', phone: '139****9999', licenseNumber: '110***********5678' }
    });
  },

  previewPhoto: function (e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.accident.photos.map(p => p.url || 'https://via.placeholder.com/300');
    
    wx.previewImage({
      current: url || urls[0],
      urls: urls
    });
  },

  goToCertificate: function () {
    if (this.data.accident?.certificate?.id) {
      wx.navigateTo({
        url: `/pages/certificate-detail/index?id=${this.data.accident.certificate.id}`
      });
    } else {
      wx.showToast({
        title: '认定书暂未生成',
        icon: 'none'
      });
    }
  },

  callPolice: function () {
    wx.showModal({
      title: '联系交警',
      content: '确定要拨打122报警电话吗？',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '122'
          });
        }
      }
    });
  },

  onShareAppMessage: function () {
    return {
      title: `事故详情 - ${this.data.accident?.accidentNumber || ''}`,
      path: `/pages/accident-detail/index?id=${this.data.accidentId}`
    };
  }
});
