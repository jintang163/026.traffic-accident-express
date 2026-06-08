const app = getApp();
const { recognizePlate } = require('../../services/ocr');
const { submitReport } = require('../../services/accident');
const { getLocation, getAddressByLatLng } = require('../../utils/location');
const { addWatermark, addWatermarks, formatDate } = require('../../utils/watermark');

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
    
    submitting: false,
    submitResult: null,
    
    gettingLocation: false,
    recognizing: false
  },

  onLoad: function (options) {
    const now = new Date();
    const timeStr = formatDate(now);
    this.setData({
      accidentTime: timeStr
    });
    this.getCurrentLocation();
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
      this.setData({ currentStep: this.data.currentStep - 1 });
    }
  },

  validateCurrentStep: function () {
    const { currentStep, vehicles, photos, accidentType, location, driverA, driverB } = this.data;
    
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
        if (!location) {
          wx.showToast({ title: '请获取事故位置', icon: 'none' });
          return false;
        }
        if (!driverA.name || !driverA.phone) {
          wx.showToast({ title: '请填写A车驾驶员信息', icon: 'none' });
          return false;
        }
        if (!driverB.name || !driverB.phone) {
          wx.showToast({ title: '请填写B车驾驶员信息', icon: 'none' });
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

  onTimeChange: function (e) {
    this.setData({ accidentTime: e.detail.value });
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
  },

  onDescriptionInput: function (e) {
    this.setData({ description: e.detail.value });
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

  doSubmit: function () {
    this.setData({ submitting: true });
    
    const reportData = {
      accidentType: this.data.accidentType,
      accidentTime: this.data.accidentTime,
      location: this.data.location,
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      description: this.data.description,
      weather: this.data.weather,
      roadCondition: this.data.roadCondition,
      vehicles: this.data.vehicles.map(v => ({
        plateNumber: v.plateNumber,
        plateColor: v.plateColor,
        photo: v.photo
      })),
      photos: this.data.photos,
      platePhotos: this.data.vehicles.filter(v => v.photo).map(v => v.photo),
      driverA: this.data.driverA,
      driverB: this.data.driverB
    };
    
    console.log('[Report] 提交数据:', reportData);
    
    submitReport(reportData).then((result) => {
      console.log('[Report] 提交成功:', result);
      this.setData({
        submitting: false,
        submitResult: result,
        currentStep: 4
      });
      
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
    }).catch((err) => {
      console.error('[Report] 提交失败:', err);
      this.setData({ submitting: false });
      
      wx.showModal({
        title: '提交失败',
        content: err.message || '网络错误，请稍后重试',
        showCancel: false
      });
    });
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
    this.setData({
      currentStep: 0,
      vehicles: [
        { plateNumber: '', plateColor: '', confidence: 0, photo: '' },
        { plateNumber: '', plateColor: '', confidence: 0, photo: '' }
      ],
      photos: [],
      accidentType: '',
      accidentTypeIndex: -1,
      description: '',
      submitResult: null
    });
    
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
