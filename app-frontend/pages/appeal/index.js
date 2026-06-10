const { createAppeal, getAppealByAccidentId, uploadAppealEvidence } = require('../../services/appeal');
const { getAppealWindow, getAccidentDetail } = require('../../services/accident');
const { sendSmsCode, verifySmsCode, startFaceVerify, mockFaceVerifyPass } = require('../../services/security');

Page({
  data: {
    accidentId: '',
    accident: null,
    appealWindow: null,
    existingAppeal: null,
    reason: '',
    disputedPoints: [],
    disputedOptions: [
      { key: 'fact', label: '事故事实认定有误' },
      { key: 'liability', label: '责任比例判定不公' },
      { key: 'legal', label: '适用法律条款错误' },
      { key: 'procedure', label: '处理程序存在瑕疵' },
      { key: 'evidence', label: '关键证据未被采纳' },
      { key: 'other', label: '其他' },
    ],
    dashcamVideoUrl: '',
    evidencePhotoUrls: [],
    additionalDescription: '',
    verifyMethod: 'sms',
    phone: '',
    smsCode: '',
    countdown: 0,
    faceTransactionId: '',
    faceVerified: false,
    verifyToken: '',
    submitting: false,
    step: 1,
  },

  onLoad(options) {
    const accidentId = options.accidentId;
    this.setData({ accidentId });
    this.loadAccident();
    this.loadAppealInfo();
  },

  loadAccident() {
    getAccidentDetail(this.data.accidentId)
      .then((acc) => {
        const phone = (acc && acc.vehicles && acc.vehicles[0] && acc.vehicles[0].ownerPhone) || '';
        this.setData({ accident: acc, phone: phone || this.data.phone });
      })
      .catch(() => {});
  },

  loadAppealInfo() {
    Promise.all([
      getAppealWindow(this.data.accidentId),
      getAppealByAccidentId(this.data.accidentId),
    ]).then(([w, appeal]) => {
      this.setData({ appealWindow: w || null, existingAppeal: appeal || null });
      if (!w || !w.canAppeal) {
        wx.showModal({
          title: '不可申诉',
          content: (w && w.reason) || '该事故暂不可申诉',
          showCancel: false,
          confirmText: '我知道了',
        });
      }
    });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value });
  },

  onDisputedTap(e) {
    const key = e.currentTarget.dataset.key;
    let list = this.data.disputedPoints.slice();
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1);
    else list.push(key);
    this.setData({ disputedPoints: list });
  },

  onVideoInput(e) {
    this.setData({ dashcamVideoUrl: e.detail.value });
  },

  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: 120,
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        wx.showLoading({ title: '上传视频...' });
        uploadAppealEvidence(file.tempFilePath, 'video')
          .then((r) => {
            this.setData({ dashcamVideoUrl: (r && (r.url || (r.data && r.data.url))) || file.tempFilePath });
          })
          .catch(() => {
            this.setData({ dashcamVideoUrl: file.tempFilePath });
          })
          .finally(() => wx.hideLoading());
      },
    });
  },

  choosePhotos() {
    wx.chooseMedia({
      count: 9 - this.data.evidencePhotoUrls.length,
      mediaType: ['image'],
      success: (res) => {
        const files = res.tempFiles || [];
        this._uploadPhotos(files.map((f) => f.tempFilePath));
      },
    });
  },

  async _uploadPhotos(list) {
    wx.showLoading({ title: '上传证据...' });
    const urls = this.data.evidencePhotoUrls.slice();
    for (let i = 0; i < list.length; i++) {
      try {
        const r = await uploadAppealEvidence(list[i], 'evidence');
        const url = (r && (r.url || (r.data && r.data.url))) || list[i];
        urls.push(url);
      } catch (e) {
        urls.push(list[i]);
      }
    }
    wx.hideLoading();
    this.setData({ evidencePhotoUrls: urls });
  },

  removePhoto(e) {
    const i = e.currentTarget.dataset.index;
    const urls = this.data.evidencePhotoUrls.slice();
    urls.splice(i, 1);
    this.setData({ evidencePhotoUrls: urls });
  },

  onDescInput(e) {
    this.setData({ additionalDescription: e.detail.value });
  },

  switchMethod(e) {
    this.setData({ verifyMethod: e.currentTarget.dataset.method });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onSmsCodeInput(e) {
    this.setData({ smsCode: e.detail.value });
  },

  sendCode() {
    if (!/^1\d{10}$/.test(this.data.phone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }
    sendSmsCode(this.data.phone, 'appeal')
      .then((r) => {
        wx.showToast({ title: (r && r.message) || '验证码已发送', icon: 'success' });
        if (r && r.data && r.data.mockCode) {
          wx.showModal({
            title: '开发模式',
            content: '测试验证码为：' + r.data.mockCode,
            showCancel: false,
          });
        }
        this.setData({ countdown: 60 });
        this._startCountdown();
      })
      .catch(() => wx.showToast({ title: '发送失败', icon: 'none' }));
  },

  _startCountdown() {
    const t = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(t);
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: this.data.countdown - 1 });
      }
    }, 1000);
  },

  verifySms() {
    if (!this.data.smsCode || this.data.smsCode.length < 4) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' });
      return;
    }
    verifySmsCode(this.data.phone, this.data.smsCode, 'appeal')
      .then((r) => {
        if (r && r.success && r.data) {
          this.setData({ verifyToken: r.data.token });
          wx.showToast({ title: '验证成功', icon: 'success' });
        } else {
          wx.showToast({ title: (r && r.message) || '验证失败', icon: 'none' });
        }
      })
      .catch(() => wx.showToast({ title: '验证失败', icon: 'none' }));
  },

  startFace() {
    startFaceVerify(this.data.phone)
      .then((r) => {
        if (r && r.success && r.data) {
          this.setData({ faceTransactionId: r.data.transactionId });
          wx.showModal({
            title: '人脸核身',
            content: '开发模式下点击确定将直接通过模拟人脸核身。生产环境可接入腾讯云人脸核身SDK。',
            success: (res) => {
              if (res.confirm) {
                mockFaceVerifyPass(r.data.transactionId).then((fr) => {
                  if (fr && fr.success && fr.data) {
                    this.setData({ faceVerified: true, verifyToken: fr.data.token });
                    wx.showToast({ title: '人脸核身通过', icon: 'success' });
                  } else {
                    wx.showToast({ title: '核身失败', icon: 'none' });
                  }
                });
              }
            },
          });
        }
      })
      .catch(() => wx.showToast({ title: '核身启动失败', icon: 'none' }));
  },

  nextStep() {
    if (!this.data.reason || this.data.reason.length < 10) {
      wx.showToast({ title: '请详细描述申诉理由（不少于10字）', icon: 'none' });
      return;
    }
    this.setData({ step: 2 });
  },

  prevStep() {
    this.setData({ step: 1 });
  },

  submit() {
    if (!this.data.verifyToken) {
      wx.showToast({ title: '请先完成身份验证', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    createAppeal({
      accidentId: this.data.accidentId,
      reason: this.data.reason,
      disputedPoints: this.data.disputedPoints,
      dashcamVideoUrl: this.data.dashcamVideoUrl,
      evidencePhotoUrls: this.data.evidencePhotoUrls,
      additionalDescription: this.data.additionalDescription,
      verifyMethod: this.data.verifyMethod,
      verifyToken: this.data.verifyToken,
    })
      .then((r) => {
        wx.showToast({ title: '申诉提交成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1200);
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
      })
      .finally(() => this.setData({ submitting: false }));
  },
});
