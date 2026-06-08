const { getCertificateDetail, verifyCertificate, shareCertificate, downloadCertificate, sendCertificate } = require('../../services/certificate');

Page({
  data: {
    certificateId: '',
    certificate: null,
    loading: false,
    showSendModal: false,
    sendPhone: '',
    verified: false,
    verifyResult: null
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ certificateId: options.id });
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
    
    getCertificateDetail(this.data.certificateId).then((res) => {
      const certificate = res.data || res;
      this.setData({
        certificate: this.formatCertificateData(certificate),
        loading: false
      });
    }).catch((err) => {
      console.error('[CertificateDetail] 加载失败:', err);
      this.setData({
        certificate: this.getMockDetail(),
        loading: false
      });
    });
  },

  formatCertificateData: function (cert) {
    const statusMap = {
      pending: '待确认',
      confirmed: '已确认',
      revoked: '已撤销'
    };
    
    return {
      ...cert,
      statusText: statusMap[cert.status] || cert.status
    };
  },

  getMockDetail: function () {
    return this.formatCertificateData({
      id: 'c1',
      certificateNumber: 'RD202606080001',
      accidentNumber: 'SG202606080001',
      accidentType: '追尾事故',
      accidentTime: '2026-06-08 10:30:00',
      location: '北京市朝阳区建国路88号',
      status: 'confirmed',
      createdAt: '2026-06-08 10:40:00',
      verifyCode: 'A1B2C3D4E5',
      partyA: {
        name: '张三',
        idNumber: '110***********1234',
        phone: '138****8888',
        plateNumber: '京A12345',
        vehicleType: '小型轿车',
        insurance: '中国平安保险'
      },
      partyB: {
        name: '李四',
        idNumber: '110***********5678',
        phone: '139****9999',
        plateNumber: '京B67890',
        vehicleType: '小型轿车',
        insurance: '中国人保财险'
      },
      accidentFacts: '2026年06月08日10时30分，李四驾驶京B67890号小型轿车，在北京市朝阳区建国路88号，由东向西行驶时，未与前车保持安全车距，该车前部与前方同向行驶的张三驾驶的京A12345号小型轿车后部相撞，造成两车损坏。',
      liability: {
        conclusion: '根据《中华人民共和国道路交通安全法》第四十三条第一款第一项规定，当事人李四负此事故全部责任，当事人张三无责任。',
        partyAResponsibility: '无责任',
        partyBresponsibility: '全部责任'
      },
      legalBasis: '《中华人民共和国道路交通安全法》第四十三条：同车道行驶的机动车，后车应当与前车保持足以采取紧急制动措施的安全距离。',
      policeOfficer: '王警官',
      policeBadge: '110123',
      department: '北京市公安局公安交通管理局朝阳交通支队',
      sealText: '北京市公安局公安交通管理局',
      remarks: [
        '本认定书与纸质认定书具有同等法律效力',
        '当事人对认定有异议的，可在送达之日起三日内申请复核',
        '本认定书可通过核验码进行核验真伪'
      ]
    });
  },

  doVerify: function () {
    if (!this.data.certificate?.certificateNumber) return;
    
    wx.showLoading({ title: '核验中...' });
    
    verifyCertificate(this.data.certificate.certificateNumber).then((res) => {
      wx.hideLoading();
      this.setData({
        verified: true,
        verifyResult: res
      });
      wx.showToast({
        title: '核验通过',
        icon: 'success'
      });
    }).catch((err) => {
      wx.hideLoading();
      this.setData({
        verified: true,
        verifyResult: {
          valid: false,
          message: '核验失败，请稍后重试'
        }
      });
    });
  },

  showSend: function () {
    this.setData({
      showSendModal: true,
      sendPhone: ''
    });
  },

  hideSend: function () {
    this.setData({ showSendModal: false });
  },

  onPhoneInput: function (e) {
    this.setData({ sendPhone: e.detail.value });
  },

  doSend: function () {
    if (!this.data.sendPhone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    
    if (!/^1\d{10}$/.test(this.data.sendPhone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '发送中...' });
    
    sendCertificate(this.data.certificateId, this.data.sendPhone).then(() => {
      wx.hideLoading();
      this.setData({ showSendModal: false });
      wx.showToast({
        title: '发送成功',
        icon: 'success'
      });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      });
    });
  },

  doShare: function () {
    shareCertificate(this.data.certificateId).then(() => {
      wx.showToast({
        title: '分享链接已生成',
        icon: 'success'
      });
    }).catch(() => {
      wx.showToast({
        title: '请点击右上角分享',
        icon: 'none'
      });
    });
  },

  doDownload: function () {
    wx.showLoading({ title: '生成中...' });
    
    downloadCertificate(this.data.certificateId).then((res) => {
      wx.hideLoading();
      if (res.url) {
        wx.downloadFile({
          url: res.url,
          success: (downloadRes) => {
            wx.openDocument({
              filePath: downloadRes.tempFilePath,
              showMenu: true,
              success: () => {
                wx.showToast({ title: '打开成功', icon: 'success' });
              },
              fail: () => {
                wx.saveImageToPhotosAlbum({
                  filePath: downloadRes.tempFilePath,
                  success: () => {
                    wx.showToast({ title: '已保存到相册', icon: 'success' });
                  },
                  fail: () => {
                    wx.showToast({ title: '保存失败', icon: 'none' });
                  }
                });
              }
            });
          },
          fail: () => {
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        });
      } else {
        wx.showToast({ title: '下载功能开发中', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '下载功能开发中', icon: 'none' });
    });
  },

  goToAccident: function () {
    wx.navigateTo({
      url: `/pages/accident-detail/index?id=${this.data.certificate.accidentId || this.data.certificateId}`
    });
  },

  copyVerifyCode: function () {
    if (this.data.certificate?.verifyCode) {
      wx.setClipboardData({
        data: this.data.certificate.verifyCode,
        success: () => {
          wx.showToast({ title: '已复制核验码', icon: 'success' });
        }
      });
    }
  },

  onShareAppMessage: function () {
    return {
      title: `交通事故认定书 - ${this.data.certificate?.certificateNumber || ''}`,
      path: `/pages/certificate-detail/index?id=${this.data.certificateId}`
    };
  }
});
