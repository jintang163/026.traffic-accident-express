App({
  onLaunch: function () {
    console.log('[App] 交通事故快处小程序启动');
    
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
    }
    
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
        this.globalData.statusBarHeight = res.statusBarHeight;
        this.globalData.navBarHeight = res.statusBarHeight + 44;
      }
    });
  },

  onShow: function () {
    console.log('[App] 小程序显示');
  },

  onHide: function () {
    console.log('[App] 小程序隐藏');
  },

  onError: function (msg) {
    console.error('[App] 全局错误:', msg);
  },

  setToken: function(token) {
    this.globalData.token = token;
    wx.setStorageSync('token', token);
  },

  clearToken: function() {
    this.globalData.token = null;
    wx.removeStorageSync('token');
  },

  globalData: {
    token: null,
    systemInfo: null,
    statusBarHeight: 20,
    navBarHeight: 64,
    baseUrl: 'http://localhost:3000/api',
    location: null
  }
});
