const { getCertificateDetail, verifyCertificate, shareCertificate, downloadCertificate, downloadCertificatePdf, regenerateCertificatePdf, sendCertificate, getCertificateThumbnail, regenerateCertificateThumbnail, sendCertificateEmail } = require('../../services/certificate');

Page({
  data: {
    certificateId: '',
    certificate: null,
    loading: false,
    showSendModal: false,
    sendPhone: '',
    sendEmail: '',
    sendMode: 'phone',
    verified: false,
    verifyResult: null,
    thumbnailUrl: '',
    shareData: null,
    showSharePanel: false,
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ certificateId: options.id });
      this.loadDetail();
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
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
        loading: false,
        thumbnailUrl: certificate.thumbnailUrl || '',
      });
      wx.setNavigationBarTitle({
        title: certificate.templateType === 'agreement' ? '道路交通事故自行协商协议书' : '道路交通事故认定书',
      });
      if (!certificate.thumbnailUrl) {
        this.loadThumbnail();
      }
    }).catch((err) => {
      console.error('[CertificateDetail] 加载失败:', err);
      this.setData({ loading: false });
    });
  },

  loadThumbnail() {
    getCertificateThumbnail(this.data.certificateId)
      .then((r) => {
        if (r && r.url) {
          this.setData({ thumbnailUrl: r.url, 'certificate.thumbnailUrl': r.url });
        }
      })
      .catch(() => {});
  },

  formatCertificateData: function (cert) {
    const statusMap = {
      draft: '草稿',
      issued: '已出具',
      verified: '已核验',
      revoked: '已撤销',
    };

    return {
      ...cert,
      statusText: statusMap[cert.status] || cert.status,
    };
  },

  doVerify: function () {
    const cert = this.data.certificate || {};
    if (!cert.certificateNo) return;

    wx.showLoading({ title: '核验中...' });

    verifyCertificate(cert.certificateNo, cert.verifyCode).then((res) => {
      wx.hideLoading();
      this.setData({ verified: true, verifyResult: res && res.data ? res.data : res });
      wx.showToast({ title: (res && res.data && res.data.valid) ? '核验通过' : '核验未通过', icon: (res && res.data && res.data.valid) ? 'success' : 'none' });
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ verified: true, verifyResult: { valid: false, message: '核验失败，请稍后重试' } });
    });
  },

  openSharePanel() {
    shareCertificate(this.data.certificateId)
      .then((r) => {
        const data = r && r.data ? r.data : r;
        this.setData({ shareData: data, showSharePanel: true });
        wx.showShareMenu({ withShareTicket: true });
      })
      .catch(() => {
        this.setData({ showSharePanel: true });
        wx.showShareMenu({ withShareTicket: true });
      });
  },

  closeSharePanel() {
    this.setData({ showSharePanel: false });
  },

  shareWechatFriend() {
    wx.showToast({ title: '请点击右上角按钮 → 选择"发送给朋友"', icon: 'none' });
  },

  shareWechatMoments() {
    if (!this.data.thumbnailUrl) {
      wx.showToast({ title: '请先生成缩略图', icon: 'none' });
      return;
    }
    wx.previewImage({
      urls: [this.data.thumbnailUrl],
      current: this.data.thumbnailUrl,
    });
    wx.showToast({ title: '长按图片可保存到相册后分享朋友圈', icon: 'none' });
  },

  saveToAlbum() {
    if (!this.data.thumbnailUrl) {
      wx.showToast({ title: '缩略图生成中，请稍后', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中...' });
    wx.downloadFile({
      url: this.data.thumbnailUrl,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: (err) => {
            wx.hideLoading();
            if (err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
              wx.showModal({
                title: '授权提示',
                content: '需要您授权保存图片到相册的权限',
                confirmText: '去设置',
                success: (r) => {
                  if (r.confirm) wx.openSetting();
                },
              });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          },
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载图片失败', icon: 'none' });
      },
    });
  },

  previewThumbnail() {
    if (this.data.thumbnailUrl) {
      wx.previewImage({ urls: [this.data.thumbnailUrl], current: this.data.thumbnailUrl });
    }
  },

  showSend: function () {
    this.setData({ showSendModal: true, sendMode: 'phone', sendPhone: '', sendEmail: '' });
  },

  hideSend: function () {
    this.setData({ showSendModal: false });
  },

  switchSendMode(e) {
    this.setData({ sendMode: e.currentTarget.dataset.mode });
  },

  onPhoneInput: function (e) {
    this.setData({ sendPhone: e.detail.value });
  },

  onEmailInput: function (e) {
    this.setData({ sendEmail: e.detail.value });
  },

  doSend: function () {
    if (this.data.sendMode === 'phone') {
      if (!this.data.sendPhone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!/^1\d{10}$/.test(this.data.sendPhone)) { wx.showToast({ title: '手机号格式错误', icon: 'none' }); return; }
      wx.showLoading({ title: '发送中...' });
      sendCertificate(this.data.certificateId, this.data.sendPhone).then(() => {
        wx.hideLoading();
        this.setData({ showSendModal: false });
        wx.showToast({ title: '发送成功', icon: 'success' });
      }).catch(() => {
        wx.hideLoading(); wx.showToast({ title: '发送失败', icon: 'none' });
      });
    } else {
      if (!this.data.sendEmail) { wx.showToast({ title: '请输入邮箱', icon: 'none' }); return; }
      if (!/^\S+@\S+\.\S+$/.test(this.data.sendEmail)) { wx.showToast({ title: '邮箱格式错误', icon: 'none' }); return; }
      wx.showLoading({ title: '发送邮件中...' });
      sendCertificateEmail(this.data.certificateId, this.data.sendEmail)
        .then((r) => {
          wx.hideLoading();
          const ok = r && r.success;
          this.setData({ showSendModal: false });
          wx.showToast({ title: ok ? '邮件已发送' : ((r && r.message) || '发送失败'), icon: ok ? 'success' : 'none' });
        })
        .catch(() => {
          wx.hideLoading(); wx.showToast({ title: '发送失败', icon: 'none' });
        });
    }
  },

  doDownload: function () {
    wx.showLoading({ title: '准备下载...' });

    downloadCertificate(this.data.certificateId).then((res) => {
      const pdfUrl = (res && (res.url || (res.data && res.data.url))) || (this.data.certificate && this.data.certificate.pdfUrl) || '';
      const finalUrl = pdfUrl || downloadCertificatePdf(this.data.certificateId);
      if (finalUrl) {
        wx.downloadFile({
          url: finalUrl,
          success: (downloadRes) => {
            wx.hideLoading();
            wx.openDocument({
              filePath: downloadRes.tempFilePath,
              showMenu: true,
              fileType: 'pdf',
              success: () => wx.showToast({ title: '打开成功', icon: 'success' }),
              fail: () => wx.showToast({ title: '打开失败', icon: 'none' }),
            });
          },
          fail: () => {
            wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' });
          },
        });
      } else {
        wx.hideLoading(); this.doRegeneratePdf();
      }
    }).catch(() => {
      wx.hideLoading();
      const pdfUrl = downloadCertificatePdf(this.data.certificateId);
      if (pdfUrl) {
        wx.downloadFile({
          url: pdfUrl,
          success: (downloadRes) => {
            wx.openDocument({
              filePath: downloadRes.tempFilePath, showMenu: true, fileType: 'pdf',
            });
          },
        });
      }
    });
  },

  doRegeneratePdf: function () {
    wx.showLoading({ title: '生成PDF中...' });
    regenerateCertificatePdf(this.data.certificateId).then((res) => {
      wx.hideLoading();
      const data = res && res.data ? res.data : res;
      if (data && data.pdfUrl) {
        this.setData({
          'certificate.pdfUrl': data.pdfUrl,
          'certificate.qrCodeUrl': data.qrCodeUrl,
          'certificate.signatureInfo': data.signatureInfo,
          'certificate.pdfGeneratedAt': data.pdfGeneratedAt,
        });
        wx.showToast({ title: 'PDF生成成功', icon: 'success' });
      } else {
        wx.showToast({ title: 'PDF生成中，请稍后刷新', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading(); wx.showToast({ title: 'PDF生成失败', icon: 'none' });
    });
  },

  regenerateThumbnail() {
    wx.showLoading({ title: '生成中...' });
    regenerateCertificateThumbnail(this.data.certificateId)
      .then((r) => {
        wx.hideLoading();
        const url = (r && (r.url || (r.data && r.data.thumbnailUrl))) || '';
        if (url) {
          this.setData({ thumbnailUrl: url, 'certificate.thumbnailUrl': url });
          wx.showToast({ title: '生成成功', icon: 'success' });
        } else {
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.hideLoading(); wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },

  previewQrCode: function () {
    if (this.data.certificate?.qrCodeUrl) {
      wx.previewImage({ urls: [this.data.certificate.qrCodeUrl], current: this.data.certificate.qrCodeUrl });
    }
  },

  goToAccident: function () {
    const accId = this.data.certificate && (this.data.certificate.accidentId || this.data.certificate.accident && this.data.certificate.accident.id);
    if (accId) {
      wx.navigateTo({ url: '/pages/accident-detail/index?id=' + accId });
    }
  },

  goToAppeal() {
    const accId = this.data.certificate && (this.data.certificate.accidentId || this.data.certificate.accident && this.data.certificate.accident.id);
    if (accId) {
      wx.navigateTo({ url: '/pages/appeal/index?accidentId=' + accId });
    }
  },

  copyVerifyCode: function () {
    if (this.data.certificate?.verifyCode) {
      wx.setClipboardData({
        data: this.data.certificate.verifyCode,
        success: () => wx.showToast({ title: '已复制核验码', icon: 'success' }),
      });
    }
  },

  onShareAppMessage: function () {
    const data = this.data.shareData || {};
    const cert = this.data.certificate || {};
    const title = data.title || cert.templateType === 'agreement' ? '道路交通事故自行协商协议书' : '道路交通事故认定书';
    const path = data.shareUrl ? '/pages/verify/index?no=' + (cert.certificateNo || '') + '&code=' + (cert.verifyCode || '') : '/pages/certificate-detail/index?id=' + this.data.certificateId;
    return {
      title: title + ' - ' + (cert.certificateNo || ''),
      path: path,
      imageUrl: data.thumbnailUrl || this.data.thumbnailUrl || '',
    };
  },

  onShareTimeline: function () {
    const cert = this.data.certificate || {};
    return {
      title: cert.templateType === 'agreement' ? '道路交通事故自行协商协议书' : '道路交通事故认定书 - ' + (cert.certificateNo || ''),
      query: 'id=' + this.data.certificateId,
      imageUrl: this.data.thumbnailUrl || '',
    };
  },
});
