function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000,
      success: (res) => {
        console.log('[Location] 获取位置成功:', res);
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          altitude: res.altitude,
          accuracy: res.accuracy
        });
      },
      fail: (err) => {
        console.error('[Location] 获取位置失败:', err);
        
        wx.showModal({
          title: '定位权限',
          content: '需要获取您的位置信息，用于记录事故发生地点。请在设置中开启定位权限。',
          confirmText: '去设置',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.openSetting({
                success: (settingRes) => {
                  if (settingRes.authSetting['scope.userLocation']) {
                    getLocation().then(resolve).catch(reject);
                  } else {
                    reject(new Error('用户拒绝定位权限'));
                  }
                }
              });
            } else {
              reject(err);
            }
          }
        });
      }
    });
  });
}

function chooseLocation() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success: (res) => {
        console.log('[Location] 选择位置成功:', res);
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name,
          address: res.address
        });
      },
      fail: (err) => {
        console.error('[Location] 选择位置失败:', err);
        reject(err);
      }
    });
  });
}

function formatAddress(address) {
  if (!address) return '';
  if (address.detail) {
    return `${address.province || ''}${address.city || ''}${address.district || ''}${address.detail || ''}`;
  }
  return address;
}

function getAddressByLatLng(latitude, longitude) {
  return new Promise((resolve, reject) => {
    console.log('[Location] 逆地理编码:', latitude, longitude);
    
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        location: `${latitude},${longitude}`,
        key: 'OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77',
        get_poi: 0
      },
      success: (res) => {
        if (res.data && res.data.status === 0) {
          const result = res.data.result;
          resolve({
            address: result.address,
            formatted_addresses: result.formatted_addresses,
            address_component: result.address_component,
            latitude: latitude,
            longitude: longitude
          });
        } else {
          reject(res.data);
        }
      },
      fail: reject
    });
  });
}

module.exports = {
  getLocation,
  chooseLocation,
  formatAddress,
  getAddressByLatLng
};
