const { getCertificateList, verifyCertificate } = require('../../services/certificate');

Page({
  data: {
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待处理' },
      { key: 'completed', label: '已完成' }
    ],
    certificates: [],
    loading: false,
    verifyCode: '',
    showVerifyModal: false,
    verifyResult: null
  },

  onLoad: function () {
    this.loadData();
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
    
    getCertificateList({ status: this.data.activeTab }).then((res) => {
      this.setData({
        certificates: res.list || res.data || this.getMockCertificates(),
        loading: false
      });
    }).catch((err) => {
      console.error('[Certificates] 加载失败:', err);
      this.setData({
        certificates: this.getMockCertificates(),
        loading: false
      });
    });
  },

  getMockCertificates: function () {
    return [
      {
        id: '1',
        certificateNumber: 'RD202606080001',
        accidentNumber: 'SG202606080001',
        accidentTime: '2026-06-08 10:30',
        location: '北京市朝阳区建国路88号',
        partyA: '张三 · 京A12345',
        partyB: '李四 · 沪B67890',
        liability: '后车未保持安全车距，负全部责任',
        status: 'completed',
        statusText: '已完成',
        createdAt: '2026-06-08 10:45',
        verifyCode: 'A1B2C3'
      },
      {
        id: '2',
        certificateNumber: 'RD202606070002',
        accidentNumber: 'SG202606070002',
        accidentTime: '2026-06-07 14:20',
        location: '北京市海淀区中关村大街1号',
        partyA: '王五 · 粤C11111',
        partyB: '赵六 · 浙D22222',
        liability: '变道车辆未观察，负主要责任',
        status: 'pending',
        statusText: '待确认',
        createdAt: '2026-06-07 14:35',
        verifyCode: 'D4E5F6'
      }
    ];
  },

  switchTab: function (e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.loadData();
  },

  goToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/certificate-detail/index?id=${id}`
    });
  },

  showVerify: function () {
    this.setData({ 
      showVerifyModal: true,
      verifyCode: '',
      verifyResult: null
    });
  },

  hideVerify: function () {
    this.setData({ showVerifyModal: false });
  },

  onVerifyInput: function (e) {
    this.setData({ verifyCode: e.detail.value.toUpperCase() });
  },

  doVerify: function () {
    if (!this.data.verifyCode) {
      wx.showToast({
        title: '请输入核验码',
        icon: 'none'
      });
      return;
    }

    verifyCertificate(this.data.verifyCode).then((res) => {
      this.setData({ verifyResult: res });
      wx.showToast({
        title: '核验成功',
        icon: 'success'
      });
    }).catch((err) => {
      console.error('[Certificates] 核验失败:', err);
      this.setData({
        verifyResult: {
          valid: false,
          message: '核验码无效或认定书不存在'
        }
      });
    });
  },

  shareCertificate: function (e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.showShareMenu({
      withShareTicket: true
    });
  },

  downloadCertificate: function (e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '下载功能开发中',
      icon: 'none'
    });
  },

  onShareAppMessage: function () {
    return {
      title: '交通事故电子认定书',
      path: '/pages/certificates/index'
    };
  }
});
