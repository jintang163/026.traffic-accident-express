const app = getApp();
const { getAccidentList, getAccidentStatistics } = require('../../services/accident');

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 64,
    recentAccidents: [],
    statistics: {
      total: 0,
      pending: 0,
      completed: 0
    },
    loading: false
  },

  onLoad: function () {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight
    });
  },

  onShow: function () {
    this.loadData();
  },

  onPullDownRefresh: function () {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData: function () {
    this.setData({ loading: true });
    
    Promise.all([
      this.loadRecentAccidents(),
      this.loadStatistics()
    ]).finally(() => {
      this.setData({ loading: false });
    });
  },

  loadRecentAccidents: function () {
    return getAccidentList({ page: 1, pageSize: 5 }).then((res) => {
      this.setData({
        recentAccidents: res.list || res.data || []
      });
    }).catch((err) => {
      console.error('[Home] 加载最近事故失败:', err);
      this.setData({
        recentAccidents: [
          {
            id: '1',
            accidentNumber: 'SG202606080001',
            accidentType: 'rear_end',
            accidentTypeText: '追尾事故',
            location: '北京市朝阳区建国路88号',
            accidentTime: '2026-06-08 10:30',
            status: 'completed',
            statusText: '已完成'
          },
          {
            id: '2',
            accidentNumber: 'SG202606070002',
            accidentType: 'side_swipe',
            accidentTypeText: '变道刮擦',
            location: '北京市海淀区中关村大街1号',
            accidentTime: '2026-06-07 14:20',
            status: 'pending',
            statusText: '处理中'
          }
        ]
      });
    });
  },

  loadStatistics: function () {
    return getAccidentStatistics().then((res) => {
      this.setData({
        statistics: res.data || {
          total: 12,
          pending: 2,
          completed: 10
        }
      });
    }).catch((err) => {
      console.error('[Home] 加载统计数据失败:', err);
      this.setData({
        statistics: {
          total: 12,
          pending: 2,
          completed: 10
        }
      });
    });
  },

  goToReport: function () {
    wx.switchTab({
      url: '/pages/report/index'
    });
  },

  goToAccidentDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/accident-detail/index?id=${id}`
    });
  },

  goToCertificates: function () {
    wx.switchTab({
      url: '/pages/certificates/index'
    });
  },

  goToCamera: function () {
    wx.navigateTo({
      url: '/pages/camera/index?mode=plate'
    });
  },

  callPolice: function () {
    wx.makePhoneCall({
      phoneNumber: '122',
      success: () => {
        console.log('[Home] 拨打报警电话成功');
      },
      fail: (err) => {
        console.error('[Home] 拨打报警电话失败:', err);
      }
    });
  },

  callInsurance: function () {
    wx.showActionSheet({
      itemList: ['中国平安 95511', '中国人保 95518', '太平洋保险 95500', '中国人寿 95519'],
      success: (res) => {
        const phones = ['95511', '95518', '95500', '95519'];
        wx.makePhoneCall({
          phoneNumber: phones[res.tapIndex]
        });
      }
    });
  },

  showGuide: function () {
    wx.showModal({
      title: '快速处理流程',
      content: '1. 开启双闪，放置三角警示牌\n2. 拍摄两车车牌和事故现场\n3. 填写事故信息并提交\n4. 等待责任认定生成认定书',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});
