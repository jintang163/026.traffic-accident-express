// pages/verify/index.js
const { verifyCertificate, downloadCertificatePdf } = require('../../services/certificate');

const accidentTypeMap = {
  rear_end: '追尾',
  side_swipe: '剐蹭',
  head_on: '正面碰撞',
  reverse: '倒车事故',
  intersection: '路口事故',
  other: '其他'
};

const statusTextMap = {
  draft: '草稿',
  issued: '已出具',
  verified: '已核验',
  revoked: '已撤销'
};

const liabilityTextMap = {
  full: '全部责任',
  primary: '主要责任',
  secondary: '次要责任',
  none: '无责任'
};

const formatDate = (dateStr, withTime = false) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  if (!withTime) return ymd;
  return ymd + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

Page({
  data: {
    inputNo: '',
    inputCode: '',
    loading: false,
    hasResult: false,
    verifyResult: { valid: false, message: '' },
    cert: null,
    isAgreement: false,
    statusText: '',
    accidentTypeText: '',
    occurTimeText: '',
    issuedAtText: '',
    validUntilText: '',
    signedAtText: ''
  },

  onLoad(options) {
    const no = options.no || options.certificateNo || '';
    const code = options.code || options.verifyCode || '';
    if (no && code) {
      this.setData({ inputNo: no, inputCode: code });
      this.doVerify();
    }
  },

  onInputNo(e) {
    this.setData({ inputNo: e.detail.value });
  },

  onInputCode(e) {
    this.setData({ inputCode: e.detail.value });
  },

  async doVerify() {
    const { inputNo, inputCode } = this.data;
    if (!inputNo || !inputCode) {
      wx.showToast({ title: '请输入编号和核验码', icon: 'none' });
      return;
    }

    this.setData({ loading: true, hasResult: false });
    try {
      const res = await verifyCertificate(inputNo, inputCode);
      const valid = res?.data?.valid ?? false;
      const cert = res?.data?.certificate || null;

      let extra = {};
      if (valid && cert) {
        const parties = (cert.parties || []).map((p) => ({
          ...p,
          liabilityText: liabilityTextMap[p.liability] || '—'
        }));
        extra = {
          isAgreement: cert.templateType === 'agreement',
          statusText: statusTextMap[cert.status] || cert.status,
          accidentTypeText: cert.accident ? (accidentTypeMap[cert.accident.accidentType] || cert.accident.accidentType || '—') : '—',
          occurTimeText: cert.accident ? formatDate(cert.accident.occurTime, true) : '—',
          issuedAtText: formatDate(cert.issuedAt),
          validUntilText: formatDate(cert.validUntil),
          signedAtText: cert.signatureInfo ? formatDate(cert.signatureInfo.signedAt, true) : '',
          cert: { ...cert, parties }
        };
      }

      this.setData({
        hasResult: true,
        verifyResult: { valid, message: res?.message || '' },
        ...extra
      });
    } catch (e) {
      console.error('[Verify] 核验失败', e);
      this.setData({
        hasResult: true,
        verifyResult: { valid: false, message: '核验请求失败，请重试' }
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  resetVerify() {
    this.setData({
      inputNo: '',
      inputCode: '',
      hasResult: false,
      verifyResult: { valid: false, message: '' },
      cert: null
    });
  },

  previewQrCode() {
    if (this.data.cert?.qrCodeUrl) {
      wx.previewImage({
        urls: [this.data.cert.qrCodeUrl],
        current: this.data.cert.qrCodeUrl
      });
    }
  },

  async downloadPdf() {
    const cert = this.data.cert;
    if (!cert) return;
    wx.showLoading({ title: '准备PDF...' });
    try {
      const { downloadCertificate } = require('../../services/certificate');
      const res = await downloadCertificate(cert.id);
      const url = res.url;
      if (!url) {
        wx.hideLoading();
        wx.showToast({ title: 'PDF尚未生成，请稍后再试', icon: 'none' });
        return;
      }
      wx.downloadFile({
        url,
        success: (dr) => {
          wx.hideLoading();
          wx.openDocument({
            filePath: dr.tempFilePath,
            showMenu: true,
            fileType: 'pdf',
            success: () => wx.showToast({ title: '打开成功', icon: 'success' }),
            fail: () => wx.showToast({ title: '打开失败', icon: 'none' })
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});
