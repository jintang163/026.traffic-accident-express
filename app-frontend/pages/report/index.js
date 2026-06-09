const app = getApp();
const { recognizePlate } = require('../../services/ocr');
const { submitReport } = require('../../services/accident');
const { getLocation, getAddressByLatLng } = require('../../utils/location');
const { addWatermark, addWatermarks, formatDate } = require('../../utils/watermark');
const evidenceService = require('../../services/evidence.js');
const { post, get } = require('../../utils/request');

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function validateLicenseNo(licenseNo) {
  if (!licenseNo) return true;
  return /^\d{12,18}$/.test(licenseNo);
}

function validateTimeNotFuture(timeStr) {
  if (!timeStr) return false;
  const inputTime = new Date(timeStr.replace(/-/g, '/')).getTime();
  return inputTime <= Date.now();
}

Page({
  data: {
    currentStep: 0,
    steps: [
      { title: '车牌识别', icon: '🚗' },
      { title: '现场拍照', icon: '📷' },
      { title: '信息填写', icon: '📝' },
      { title: '提交确认', icon: '✅' }
    ],

    vehicles: [
      { plateNumber: '', plateColor: '', confidence: 0, photo: '' },
      { plateNumber: '', plateColor: '', confidence: 0, photo: '' }
    ],
    currentVehicleIndex: 0,
    editingPlate: false,

    photos: [],
    photoType: 'scene',

    accidentType: '',
    accidentTypeIndex: -1,
    accidentTypes: [
      { value: 'rear_end', label: '追尾事故' },
      { value: 'side_swipe', label: '变道刮擦' },
      { value: 'head_on', label: '正面碰撞' },
      { value: 'reverse', label: '倒车事故' },
      { value: 'intersection', label: '路口事故' },
      { value: 'other', label: '其他事故' }
    ],

    accidentTime: '',
    accidentDate: '',
    location: '',
    latitude: null,
    longitude: null,
    description: '',

    weather: '晴天',
    weatherOptions: ['晴天', '雨天', '雪天', '雾天', '阴天'],
    weatherIndex: 0,

    roadCondition: '干燥',
    roadOptions: ['干燥', '潮湿', '积水', '结冰', '积雪'],
    roadIndex: 0,

    driverA: { name: '', phone: '', license: '' },
    driverB: { name: '', phone: '', license: '' },

    collisionPositions: {
      vehicleA: [],
      vehicleB: []
    },
    collisionOptions: [
      { key: 'front', label: '车头' },
      { key: 'rear', label: '车尾' },
      { key: 'left', label: '左侧' },
      { key: 'right', label: '右侧' }
    ],

    integrityConfirmed: false,
    integrityText: '本人承诺所填写的事故信息真实、准确、完整，如有虚假愿承担相应法律责任。',

    submitting: false,
    submitResult: null,

    gettingLocation: false,
    recognizing: false,

    uploadingPhotos: [],
    uploadProgress: 0,
    overallUploadProgress: 0,
    networkInfo: null,
    isWeakNetwork: false,
    maxPhotosPerAccident: 8,
    currentPhotoCount: 0,
    uploading: false,
    uploadError: null,

    draftId: null,
    draftSaving: false,
    draftLastSaved: '',

    phoneErrors: { A: '', B: '' },
    licenseErrors: { A: '', B: '' },
    timeError: ''
  },

  onLoad: function (options) {
    const now = new Date();
    const timeStr = formatDate(now);
    const dateStr = this._formatDatePicker(now);
    this.setData({
      accidentTime: timeStr,
      accidentDate: dateStr
    });
    this.getCurrentLocation();
    this.checkNetworkSpeed();
    this.loadDraft();
  },

  _formatDatePicker: function (date) {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  _formatTimePicker: function (date) {
    const d = date || new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  checkNetworkSpeed: async function () {
    try {
      const networkInfo = await evidenceService.checkNetworkSpeed();
      this.setData({
        networkInfo,
        isWeakNetwork: networkInfo.isWeakNetwork
      });
      console.log('[Report] 网络检测结果:', networkInfo);
    } catch (error) {
      console.warn('[Report] 网络检测失败:', error);
    }
  },

  onShow: function () {
    const photos = wx.getStorageSync('reportPhotos');
    if (photos && photos.length > 0) {
      this.setData({ photos: photos });
      wx.removeStorageSync('reportPhotos');
    }

    const plateResult = wx.getStorageSync('plateResult');
    if (plateResult) {
      const { vehicleIndex, result, photo } = plateResult;
      const vehicles = this.data.vehicles;
      vehicles[vehicleIndex] = {
        ...vehicles[vehicleIndex],
        plateNumber: result.plateNumber || '',
        plateColor: result.plateColor || '',
        confidence: result.confidence || 0,
        photo: photo || ''
      };
      this.setData({ vehicles });
      wx.removeStorageSync('plateResult');
    }
  },

  onHide: function () {
    this.autoSaveDraft();
  },

  onUnload: function () {
    this.autoSaveDraft();
  },

  getCurrentLocation: function () {
    this.setData({ gettingLocation: true });

    getLocation().then((loc) => {
      this.setData({
        latitude: loc.latitude,
        longitude: loc.longitude
      });

      return getAddressByLatLng(loc.latitude, loc.longitude);
    }).then((addr) => {
      this.setData({
        location: addr.address || addr.formatted_addresses?.recommend || '',
        gettingLocation: false
      });
    }).catch((err) => {
      console.error('[Report] 获取位置失败:', err);
      this.setData({ gettingLocation: false });
    });
  },

  nextStep: function () {
    if (this.data.currentStep < 3) {
      if (!this.validateCurrentStep()) return;
      this.setData({ currentStep: this.data.currentStep + 1 });
    }
  },

  prevStep: function () {
    if (this.data.currentStep > 0) {
      this.autoSaveDraft();
      this.setData({ currentStep: this.data.currentStep - 1 });
    }
  },

  validateCurrentStep: function () {
    const { currentStep, vehicles, photos, accidentType, accidentTime, location, driverA, driverB, collisionPositions, integrityConfirmed } = this.data;

    switch (currentStep) {
      case 0:
        if (!vehicles[0].plateNumber) {
          wx.showToast({ title: '请拍摄A车车牌', icon: 'none' });
          return false;
        }
        if (!vehicles[1].plateNumber) {
          wx.showToast({ title: '请拍摄B车车牌', icon: 'none' });
          return false;
        }
        return true;

      case 1:
        if (photos.length < 3) {
          wx.showToast({ title: '请至少拍摄3张现场照片', icon: 'none' });
          return false;
        }
        return true;

      case 2:
        if (!accidentType) {
          wx.showToast({ title: '请选择事故类型', icon: 'none' });
          return false;
        }
        if (!accidentTime) {
          wx.showToast({ title: '请选择事故时间', icon: 'none' });
          return false;
        }
        if (!validateTimeNotFuture(accidentTime)) {
          this.setData({ timeError: '事故时间不能晚于当前时间' });
          wx.showToast({ title: '事故时间不能晚于当前时间', icon: 'none' });
          return false;
        }
        this.setData({ timeError: '' });
        if (!location) {
          wx.showToast({ title: '请获取事故位置', icon: 'none' });
          return false;
        }
        if (!driverA.name) {
          wx.showToast({ title: '请填写A车驾驶员姓名', icon: 'none' });
          return false;
        }
        if (!driverA.phone) {
          wx.showToast({ title: '请填写A车驾驶员联系电话', icon: 'none' });
          return false;
        }
        if (!validatePhone(driverA.phone)) {
          this.setData({ 'phoneErrors.A': '手机号格式不正确' });
          wx.showToast({ title: 'A车手机号格式不正确', icon: 'none' });
          return false;
        }
        if (driverA.license && !validateLicenseNo(driverA.license)) {
          this.setData({ 'licenseErrors.A': '驾驶证号格式不正确' });
          wx.showToast({ title: 'A车驾驶证号格式不正确', icon: 'none' });
          return false;
        }
        if (!driverB.name) {
          wx.showToast({ title: '请填写B车驾驶员姓名', icon: 'none' });
          return false;
        }
        if (!driverB.phone) {
          wx.showToast({ title: '请填写B车驾驶员联系电话', icon: 'none' });
          return false;
        }
        if (!validatePhone(driverB.phone)) {
          this.setData({ 'phoneErrors.B': '手机号格式不正确' });
          wx.showToast({ title: 'B车手机号格式不正确', icon: 'none' });
          return false;
        }
        if (driverB.license && !validateLicenseNo(driverB.license)) {
          this.setData({ 'licenseErrors.B': '驾驶证号格式不正确' });
          wx.showToast({ title: 'B车驾驶证号格式不正确', icon: 'none' });
          return false;
        }
        if (collisionPositions.vehicleA.length === 0 && collisionPositions.vehicleB.length === 0) {
          wx.showToast({ title: '请勾选碰撞位置', icon: 'none' });
          return false;
        }
        return true;

      case 3:
        if (!integrityConfirmed) {
          wx.showToast({ title: '请阅读并勾选诚信申报承诺', icon: 'none' });
          return false;
        }
        return true;

      default:
        return true;
    }
  },

  goToCamera: function (e) {
    const mode = e.currentTarget.dataset.mode;
    const vehicleIndex = e.currentTarget.dataset.vehicleIndex;

    if (mode === 'plate') {
      this.setData({ currentVehicleIndex: vehicleIndex });
      wx.navigateTo({
        url: `/pages/camera/index?mode=plate&vehicleIndex=${vehicleIndex}`
      });
    } else {
      wx.navigateTo({
        url: `/pages/camera/index?mode=scene`
      });
    }
  },

  editPlateNumber: function (e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      editingPlate: true,
      currentVehicleIndex: index
    });
  },

  onPlateInput: function (e) {
    const index = this.data.currentVehicleIndex;
    const vehicles = this.data.vehicles;
    vehicles[index].plateNumber = e.detail.value.toUpperCase();
    this.setData({ vehicles });
  },

  onPlateColorChange: function (e) {
    const index = this.data.currentVehicleIndex;
    const colors = ['蓝', '黄', '绿', '白', '黑'];
    const vehicles = this.data.vehicles;
    vehicles[index].plateColor = colors[e.detail.value];
    this.setData({ vehicles });
  },

  confirmEditPlate: function () {
    this.setData({ editingPlate: false });
  },

  removePhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos;
    photos.splice(index, 1);
    this.setData({ photos });
  },

  previewPhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos;
    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  },

  onAccidentTypeChange: function (e) {
    const index = e.detail.value;
    this.setData({
      accidentTypeIndex: index,
      accidentType: this.data.accidentTypes[index].value
    });
  },

  onWeatherChange: function (e) {
    this.setData({
      weatherIndex: e.detail.value,
      weather: this.data.weatherOptions[e.detail.value]
    });
  },

  onRoadChange: function (e) {
    this.setData({
      roadIndex: e.detail.value,
      roadCondition: this.data.roadOptions[e.detail.value]
    });
  },

  onDateChange: function (e) {
    this.setData({ accidentDate: e.detail.value });
    this._updateAccidentTime();
  },

  onTimeChange: function (e) {
    const timeValue = e.detail.value;
    this.setData({
      accidentTime: this.data.accidentDate + ' ' + timeValue + ':00'
    });
    this._validateTime();
  },

  _updateAccidentTime: function () {
    const datePart = this.data.accidentDate;
    const now = new Date();
    const timePart = this._formatTimePicker(now);
    this.setData({
      accidentTime: datePart + ' ' + timePart + ':00'
    });
  },

  _validateTime: function () {
    if (!validateTimeNotFuture(this.data.accidentTime)) {
      this.setData({ timeError: '事故时间不能晚于当前时间' });
    } else {
      this.setData({ timeError: '' });
    }
  },

  onDriverInput: function (e) {
    const { field, vehicle } = e.currentTarget.dataset;
    const drivers = {
      A: 'driverA',
      B: 'driverB'
    };
    const driverKey = drivers[vehicle];
    const driver = this.data[driverKey];
    driver[field] = e.detail.value;
    this.setData({ [driverKey]: driver });

    if (field === 'phone') {
      if (e.detail.value && !validatePhone(e.detail.value)) {
        this.setData({ [`phoneErrors.${vehicle}`]: '手机号格式不正确' });
      } else {
        this.setData({ [`phoneErrors.${vehicle}`]: '' });
      }
    }
    if (field === 'license') {
      if (e.detail.value && !validateLicenseNo(e.detail.value)) {
        this.setData({ [`licenseErrors.${vehicle}`]: '驾驶证号格式不正确' });
      } else {
        this.setData({ [`licenseErrors.${vehicle}`]: '' });
      }
    }
  },

  onGetWechatPhone: function (e) {
    const vehicle = e.currentTarget.dataset.vehicle;
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      const { code } = e.detail;
      post('/auth/wechat-phone', { code }).then((res) => {
        const phone = res.phoneNumber || res.phone || '';
        if (phone) {
          const driverKey = vehicle === 'A' ? 'driverA' : 'driverB';
          const driver = this.data[driverKey];
          driver.phone = phone;
          this.setData({
            [driverKey]: driver,
            [`phoneErrors.${vehicle}`]: ''
          });
          wx.showToast({ title: '手机号获取成功', icon: 'success' });
        }
      }).catch((err) => {
        console.error('[Report] 微信手机号获取失败:', err);
        wx.showToast({ title: '手机号获取失败', icon: 'none' });
      });
    }
  },

  onDescriptionInput: function (e) {
    this.setData({ description: e.detail.value });
  },

  onCollisionToggle: function (e) {
    const { vehicle, position } = e.currentTarget.dataset;
    const key = `collisionPositions.${vehicle}`;
    const current = this.data.collisionPositions[vehicle];
    const index = current.indexOf(position);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(position);
    }
    this.setData({ [key]: [...current] });
  },

  onIntegrityChange: function (e) {
    this.setData({ integrityConfirmed: e.detail.value.length > 0 });
  },

  selectLocation: function () {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          location: res.name + ' ' + res.address,
          latitude: res.latitude,
          longitude: res.longitude
        });
      },
      fail: (err) => {
        console.error('[Report] 选择位置失败:', err);
      }
    });
  },

  autoSaveDraft: function () {
    if (this.data.submitting) return;

    const draftData = {
      vehicles: this.data.vehicles,
      accidentType: this.data.accidentType,
      accidentTypeIndex: this.data.accidentTypeIndex,
      accidentTime: this.data.accidentTime,
      accidentDate: this.data.accidentDate,
      location: this.data.location,
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      description: this.data.description,
      weather: this.data.weather,
      weatherIndex: this.data.weatherIndex,
      roadCondition: this.data.roadCondition,
      roadIndex: this.data.roadIndex,
      driverA: this.data.driverA,
      driverB: this.data.driverB,
      collisionPositions: this.data.collisionPositions,
      photos: this.data.photos
    };

    this.setData({ draftSaving: true });

    post('/accident/draft', {
      draftId: this.data.draftId,
      data: draftData
    }).then((res) => {
      this.setData({
        draftId: res.draftId || this.data.draftId,
        draftSaving: false,
        draftLastSaved: formatDate(new Date())
      });
      console.log('[Report] 草稿保存成功');
    }).catch((err) => {
      console.warn('[Report] 草稿保存失败:', err);
      this.setData({ draftSaving: false });
      try {
        wx.setStorageSync('reportDraft', {
          draftId: this.data.draftId,
          data: draftData,
          savedAt: Date.now()
        });
      } catch (e) {
        console.warn('[Report] 本地草稿保存失败:', e);
      }
    });
  },

  loadDraft: function () {
    get('/accident/draft').then((res) => {
      if (res && res.data) {
        this._applyDraftData(res.data);
        this.setData({ draftId: res.draftId });
        wx.showModal({
          title: '发现草稿',
          content: '检测到上次未完成的报案信息，是否恢复？',
          confirmText: '恢复',
          cancelText: '重新填写',
          success: (modalRes) => {
            if (!modalRes.confirm) {
              this.resetForm();
            }
          }
        });
      }
    }).catch(() => {
      try {
        const localDraft = wx.getStorageSync('reportDraft');
        if (localDraft && localDraft.data) {
          const elapsed = Date.now() - localDraft.savedAt;
          if (elapsed < 24 * 60 * 60 * 1000) {
            this._applyDraftData(localDraft.data);
            this.setData({ draftId: localDraft.draftId });
            wx.showModal({
              title: '发现草稿',
              content: '检测到上次未完成的报案信息，是否恢复？',
              confirmText: '恢复',
              cancelText: '重新填写',
              success: (modalRes) => {
                if (!modalRes.confirm) {
                  this.resetForm();
                }
              }
            });
          }
        }
      } catch (e) {
        console.warn('[Report] 本地草稿读取失败:', e);
      }
    });
  },

  _applyDraftData: function (data) {
    if (!data) return;
    const updates = {};
    if (data.vehicles) updates.vehicles = data.vehicles;
    if (data.accidentType) updates.accidentType = data.accidentType;
    if (data.accidentTypeIndex !== undefined) updates.accidentTypeIndex = data.accidentTypeIndex;
    if (data.accidentTime) updates.accidentTime = data.accidentTime;
    if (data.accidentDate) updates.accidentDate = data.accidentDate;
    if (data.location) updates.location = data.location;
    if (data.latitude) updates.latitude = data.latitude;
    if (data.longitude) updates.longitude = data.longitude;
    if (data.description) updates.description = data.description;
    if (data.weather) updates.weather = data.weather;
    if (data.weatherIndex !== undefined) updates.weatherIndex = data.weatherIndex;
    if (data.roadCondition) updates.roadCondition = data.roadCondition;
    if (data.roadIndex !== undefined) updates.roadIndex = data.roadIndex;
    if (data.driverA) updates.driverA = data.driverA;
    if (data.driverB) updates.driverB = data.driverB;
    if (data.collisionPositions) updates.collisionPositions = data.collisionPositions;
    if (data.photos) updates.photos = data.photos;
    this.setData(updates);
  },

  resetForm: function () {
    const now = new Date();
    this.setData({
      currentStep: 0,
      vehicles: [
        { plateNumber: '', plateColor: '', confidence: 0, photo: '' },
        { plateNumber: '', plateColor: '', confidence: 0, photo: '' }
      ],
      photos: [],
      accidentType: '',
      accidentTypeIndex: -1,
      accidentTime: formatDate(now),
      accidentDate: this._formatDatePicker(now),
      description: '',
      driverA: { name: '', phone: '', license: '' },
      driverB: { name: '', phone: '', license: '' },
      collisionPositions: { vehicleA: [], vehicleB: [] },
      integrityConfirmed: false,
      submitResult: null,
      phoneErrors: { A: '', B: '' },
      licenseErrors: { A: '', B: '' },
      timeError: ''
    });
    wx.removeStorageSync('reportDraft');
  },

  submit: function () {
    if (!this.validateCurrentStep()) return;

    wx.showModal({
      title: '确认提交',
      content: '提交后将自动进行责任判定并生成电子认定书，确认提交吗？',
      confirmText: '确认提交',
      success: (res) => {
        if (res.confirm) {
          this.doSubmit();
        }
      }
    });
  },

  doSubmit: async function () {
    this.setData({
      submitting: true,
      uploading: true,
      uploadProgress: 0,
      overallUploadProgress: 0,
      uploadError: null
    });

    try {
      const gpsInfo = {
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        timestamp: new Date().toISOString()
      };

      const allPhotoPaths = [
        ...this.data.vehicles.filter(v => v.photo).map(v => v.photo),
        ...this.data.photos
      ];

      console.log('[Report] 开始上传证据照片，共', allPhotoPaths.length, '张');

      const uploadResults = await evidenceService.uploadMultiplePhotos(allPhotoPaths, {
        onPhotoProgress: (index, progress) => {
          const uploadingPhotos = this.data.uploadingPhotos;
          uploadingPhotos[index] = { progress };
          this.setData({ uploadingPhotos });
        },
        onOverallProgress: (progress) => {
          this.setData({ overallUploadProgress: progress });
        }
      });

      const successfulUploads = uploadResults.filter(r => r.success);
      const failedUploads = uploadResults.filter(r => !r.success);

      if (failedUploads.length > 0) {
        console.warn('[Report] 部分照片上传失败:', failedUploads);
        if (successfulUploads.length < 3) {
          throw new Error(`有 ${failedUploads.length} 张照片上传失败，请检查网络后重试`);
        }
      }

      console.log('[Report] 证据上传完成，成功', successfulUploads.length, '张');

      const uploadedEvidenceIds = successfulUploads.map(r => r.data.evidenceId);

      const reportData = {
        accidentType: this.data.accidentType,
        accidentTime: this.data.accidentTime,
        location: this.data.location,
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        description: this.data.description,
        weather: this.data.weather,
        roadCondition: this.data.roadCondition,
        collisionPositions: this.data.collisionPositions,
        integrityConfirmed: this.data.integrityConfirmed,
        vehicles: this.data.vehicles.map((v, i) => ({
          plateNumber: v.plateNumber,
          plateColor: v.plateColor,
          photo: v.photo,
          evidenceId: i < successfulUploads.length ? successfulUploads[i].data.evidenceId : null
        })),
        photos: this.data.photos,
        platePhotos: this.data.vehicles.filter(v => v.photo).map(v => v.photo),
        evidenceIds: uploadedEvidenceIds,
        driverA: this.data.driverA,
        driverB: this.data.driverB
      };

      console.log('[Report] 提交报案数据:', reportData);

      const result = await submitReport(reportData);

      console.log('[Report] 提交成功:', result);

      try {
        if (this.data.draftId) {
          post('/accident/draft/delete', { draftId: this.data.draftId });
        }
      } catch (e) {
        console.warn('[Report] 删除草稿失败:', e);
      }
      wx.removeStorageSync('reportDraft');

      this.setData({
        submitting: false,
        uploading: false,
        submitResult: result,
        currentStep: 4
      });

      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });

    } catch (err) {
      console.error('[Report] 提交失败:', err);
      this.setData({
        submitting: false,
        uploading: false,
        uploadError: err.message
      });

      wx.showModal({
        title: '提交失败',
        content: err.message || '网络错误，请稍后重试',
        showCancel: false
      });
    }
  },

  goToCertificate: function () {
    if (this.data.submitResult?.certificate?.id) {
      wx.navigateTo({
        url: `/pages/certificate-detail/index?id=${this.data.submitResult.certificate.id}`
      });
    } else {
      wx.switchTab({
        url: '/pages/certificates/index'
      });
    }
  },

  resetAndGoHome: function () {
    this.resetForm();
    wx.switchTab({
      url: '/pages/home/index'
    });
  },

  onShareAppMessage: function () {
    return {
      title: '交通事故快速处理',
      path: '/pages/home/index'
    };
  }
});
