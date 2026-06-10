const { verifyCertificate } = require('../../services/certificate');

Page({
  data: {
    certificateNo: '',
    verifyCode: '',
    loading: false,
    result: null,
  },

  onLoad: function (options) {
    if (options.no) {
      this.setData({ certificateNo: options.no });
    }
    if (options.code) {
      this.setData({ verifyCode: options.code });
    }
    if (options.no && options.code) {
      this.doVerify();
    }
  },

  onCertificateNoInput: function (e) {
    this.setData({ certificateNo: e.detail.value });
  },

  onVerifyCodeInput: function (e) {
    this.setData({ verifyCode: e.detail.value });
  },

  doVerify: function () {
    const { certificateNo, verifyCode } = this.data;

    if (!certificateNo || !verifyCode) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' });
      return;
    }

    this.setData({ loading: true, result: null });

    verifyCertificate(certificateNo, verifyCode).then((res) => {
      this.setData({
        loading: false,
        result: {
          valid: res.valid,
          certificateNo: certificateNo,
        },
      });
    }).catch(() => {
      this.setData({
        loading: false,
        result: { valid: false, certificateNo: certificateNo },
      });
    });
  },

  onShareAppMessage: function () {
    return {
      title: '交通事故认定书核验',
      path: '/pages/certificate-verify/index?no=' + this.data.certificateNo + '&code=' + this.data.verifyCode,
    };
  },
});
