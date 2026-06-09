const app = getApp();

function request(options) {
  return new Promise((resolve, reject) => {
    const { url, method = 'GET', data = {}, header = {} } = options;
    
    const baseUrl = app.globalData.baseUrl;
    const token = app.globalData.token;
    
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('[Request]', method, url, data);
    
    wx.request({
      url: baseUrl + url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      timeout: 15000,
      success: (res) => {
        console.log('[Response]', url, res.statusCode, res.data);
        
        if (res.statusCode === 200) {
          const respData = res.data;
          if (respData.success === true || respData.code === 200 || respData.code === 0) {
            resolve(respData.data !== undefined ? respData.data : respData);
          } else if (respData.statusCode === 401 || respData.code === 401) {
            app.clearToken();
            wx.showToast({
              title: '请重新登录',
              icon: 'none'
            });
            setTimeout(() => {
              wx.navigateTo({
                url: '/pages/login/index'
              });
            }, 1500);
            reject(respData);
          } else {
            wx.showToast({
              title: respData.message || '请求失败',
              icon: 'none'
            });
            reject(respData);
          }
        } else if (res.statusCode === 401) {
          app.clearToken();
          wx.showToast({
            title: '请重新登录',
            icon: 'none'
          });
          reject(res.data);
        } else {
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
          reject(res);
        }
      },
      fail: (err) => {
        console.error('[Request Error]', url, err);
        wx.showToast({
          title: '网络连接失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

function uploadFile(options) {
  return new Promise((resolve, reject) => {
    const { url, filePath, name = 'file', data = {} } = options;
    
    const baseUrl = app.globalData.baseUrl;
    const token = app.globalData.token;
    
    const header = {};
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('[Upload]', url, filePath);
    
    wx.uploadFile({
      url: baseUrl + url,
      filePath: filePath,
      name: name,
      formData: data,
      header: header,
      success: (res) => {
        console.log('[Upload Response]', url, res.statusCode, res.data);
        
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 200) {
            if (data.success === true || data.code === 200 || data.code === 0) {
              resolve(data.data !== undefined ? data.data : data);
            } else {
              wx.showToast({
                title: data.message || '上传失败',
                icon: 'none'
              });
              reject(data);
            }
          } else {
            reject(res);
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => {
        console.error('[Upload Error]', url, err);
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

module.exports = {
  request,
  uploadFile,
  get: (url, data) => request({ url, method: 'GET', data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  delete: (url, data) => request({ url, method: 'DELETE', data })
};
