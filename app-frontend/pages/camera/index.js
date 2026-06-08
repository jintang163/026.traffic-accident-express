const app = getApp();
const { recognizePlate, mockRecognizePlate } = require('../../services/ocr');
const { getLocation } = require('../../utils/location');
const { addWatermark, formatDate } = require('../../utils/watermark');

Page({
  data: {
    mode: 'plate',
    vehicleIndex: 0,
    cameraReady: false,
    flashEnabled: false,
    frontCamera: false,
    recognizing: false,
    recognizeTimer: 0,
    recognizeTimeout: false,
    photos: [],
    currentPhoto: null,
    location: null,
    latitude: null,
    longitude: null,
    canvasHidden: true
  },

  onLoad: function (options) {
    const mode = options.mode || 'plate';
    const vehicleIndex = parseInt(options.vehicleIndex || '0');
    
    this.setData({
      mode: mode,
      vehicleIndex: vehicleIndex
    });

    wx.setNavigationBarTitle({
      title: mode === 'plate' ? '车牌识别' : '现场拍照'
    });

    this.getLocationInfo();
    this.startTimer();
  },

  onUnload: function () {
    this.stopTimer();
  },

  startTimer: function () {
    this.setData({ recognizeTimer: 0, recognizeTimeout: false });
    
    this.timerInterval = setInterval(() => {
      const newTimer = this.data.recognizeTimer + 1;
      this.setData({ recognizeTimer: newTimer });
      
      if (newTimer >= 15 && !this.data.recognizeTimeout) {
        this.setData({ recognizeTimeout: true });
        console.warn('[Camera] 识别耗时超过15秒！');
      }
    }, 1000);
  },

  stopTimer: function () {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  getLocationInfo: function () {
    getLocation().then((loc) => {
      this.setData({
        latitude: loc.latitude,
        longitude: loc.longitude
      });
    }).catch((err) => {
      console.error('[Camera] 获取位置失败:', err);
    });
  },

  onCameraReady: function () {
    console.log('[Camera] 相机就绪');
    this.setData({ cameraReady: true });
  },

  onCameraError: function (e) {
    console.error('[Camera] 相机错误:', e.detail);
    wx.showToast({
      title: '相机启动失败，请检查权限',
      icon: 'none'
    });
  },

  toggleFlash: function () {
    this.setData({ flashEnabled: !this.data.flashEnabled });
  },

  switchCamera: function () {
    this.setData({ frontCamera: !this.data.frontCamera });
  },

  takePhoto: function () {
    if (!this.data.cameraReady || this.data.recognizing) return;

    const cameraContext = wx.createCameraContext();
    
    console.log('[Camera] 开始拍照, 模式:', this.data.mode);
    
    cameraContext.takePhoto({
      quality: 'high',
      success: (res) => {
        console.log('[Camera] 拍照成功:', res.tempImagePath);
        this.setData({ currentPhoto: res.tempImagePath });
        
        if (this.data.mode === 'plate') {
          this.doRecognizePlate(res.tempImagePath);
        } else {
          this.addPhotoWithWatermark(res.tempImagePath);
        }
      },
      fail: (err) => {
        console.error('[Camera] 拍照失败:', err);
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        });
      }
    });
  },

  chooseFromAlbum: function () {
    console.log('[Camera] 从相册选择');
    
    wx.chooseMedia({
      count: this.data.mode === 'plate' ? 1 : 9,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['original'],
      success: (res) => {
        console.log('[Camera] 选择照片成功:', res.tempFiles);
        
        if (this.data.mode === 'plate' && res.tempFiles.length > 0) {
          this.setData({ currentPhoto: res.tempFiles[0].tempFilePath });
          this.doRecognizePlate(res.tempFiles[0].tempFilePath);
        } else {
          res.tempFiles.forEach((file) => {
            this.addPhotoWithWatermark(file.tempFilePath);
          });
        }
      },
      fail: (err) => {
        console.error('[Camera] 选择照片失败:', err);
      }
    });
  },

  doRecognizePlate: function (imagePath) {
    this.setData({ recognizing: true });
    this.startTimer();
    
    console.log('[Camera] 开始调用云端OCR识别车牌');
    
    recognizePlate(imagePath).then((result) => {
      console.log('[Camera] OCR识别成功:', result);
      this.stopTimer();
      
      const duration = this.data.recognizeTimer;
      if (duration > 15) {
        wx.showToast({
          title: `识别耗时${duration}秒，请注意优化`,
          icon: 'none',
          duration: 3000
        });
      }
      
      wx.setStorageSync('plateResult', {
        vehicleIndex: this.data.vehicleIndex,
        result: result,
        photo: imagePath
      });
      
      wx.showToast({
        title: '识别成功',
        icon: 'success'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
      
    }).catch((err) => {
      console.error('[Camera] OCR识别失败:', err);
      this.stopTimer();
      
      console.log('[Camera] 使用Mock数据降级');
      mockRecognizePlate().then((mockResult) => {
        wx.setStorageSync('plateResult', {
          vehicleIndex: this.data.vehicleIndex,
          result: mockResult,
          photo: imagePath
        });
        
        wx.showModal({
          title: '识别提示',
          content: `云端识别失败，已使用模拟数据：${mockResult.plateNumber}，可手动修改`,
          confirmText: '确认',
          success: () => {
            wx.navigateBack();
          }
        });
      });
    }).finally(() => {
      this.setData({ recognizing: false });
    });
  },

  addPhotoWithWatermark: function (imagePath) {
    this.setData({ canvasHidden: false });
    
    const time = formatDate(new Date());
    const location = this.data.location || '未知位置';
    
    setTimeout(() => {
      addWatermark('watermarkCanvas', imagePath, {
        text: '事故现场照片',
        time: time,
        location: location,
        latitude: this.data.latitude,
        longitude: this.data.longitude
      }).then((watermarkedPath) => {
        console.log('[Camera] 水印添加成功:', watermarkedPath);
        
        const photos = this.data.photos;
        photos.push(watermarkedPath);
        this.setData({ 
          photos: photos,
          canvasHidden: true,
          currentPhoto: null
        });
        
        wx.showToast({
          title: '拍照成功',
          icon: 'success'
        });
      }).catch((err) => {
        console.error('[Camera] 添加水印失败:', err);
        
        const photos = this.data.photos;
        photos.push(imagePath);
        this.setData({ 
          photos: photos,
          canvasHidden: true,
          currentPhoto: null
        });
        
        wx.showToast({
          title: '拍照成功（无水印）',
          icon: 'none'
        });
      });
    }, 100);
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

  confirmPhotos: function () {
    if (this.data.photos.length === 0) {
      wx.showToast({
        title: '请至少拍摄1张照片',
        icon: 'none'
      });
      return;
    }
    
    console.log('[Camera] 确认照片:', this.data.photos);
    wx.setStorageSync('reportPhotos', this.data.photos);
    
    wx.navigateBack();
  },

  retakePhoto: function () {
    this.setData({ currentPhoto: null });
  },

  onShareAppMessage: function () {
    return {
      title: '交通事故快速处理',
      path: '/pages/home/index'
    };
  }
});
