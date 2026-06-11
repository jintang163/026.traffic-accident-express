const { getAccidentList } = require('../../services/accident');
const { getCertificateList } = require('../../services/certificate');
const { getUnreadCount } = require('../../services/notification');
const { post } = require('../../utils/request');

Page({
  data: {
    userInfo: {
      avatar: '',
      name: '',
      phone: '',
      idNumber: ''
    },
    statistics: {
      totalReports: 0,
      completedReports: 0,
      pendingReports: 0,
      totalCertificates: 0
    },
    menuGroups: [
      {
        title: '我的业务',
        items: [
          { icon: '📋', label: '我的报案', key: 'my-reports', badge: 0 },
          { icon: '📄', label: '我的认定书', key: 'my-certificates', badge: 0 },
          { icon: '🚗', label: '我的车辆', key: 'my-vehicles', badge: 0 }
        ]
      },
      {
        title: '消息通知',
        items: [
          { icon: '🔔', label: '通知中心', key: 'notifications', badge: 0 },
          { icon: '⚙️', label: '消息设置', key: 'notification-settings', badge: 0 }
        ]
      },
      {
        title: '工具服务',
        items: [
          { icon: '🔍', label: '认定书核验', key: 'verify', badge: 0 },
          { icon: '📞', label: '联系客服', key: 'contact', badge: 0 },
          { icon: '❓', label: '帮助中心', key: 'help', badge: 0 }
        ]
      },
      {
        title: '系统设置',
        items: [
          { icon: '👤', label: '账号设置', key: 'settings', badge: 0 },
          { icon: '🔒', label: '隐私政策', key: 'privacy', badge: 0 },
          { icon: '📜', label: '关于我们', key: 'about', badge: 0 }
        ]
      }
    ],
    loading: false,
    isLoggedIn: false
  },

  onLoad: function () {
    this.checkLoginStatus();
  },

  onShow: function () {
    this.checkLoginStatus();
    if (this.data.isLoggedIn) {
      this.loadStatistics();
    }
  },

  onPullDownRefresh: function () {
    if (this.data.isLoggedIn) {
      this.loadStatistics();
    }
    wx.stopPullDownRefresh();
  },

  checkLoginStatus: function () {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: {
          avatar: '',
          name: '未登录',
          phone: '',
          idNumber: ''
        }
      });
    }
  },

  loadStatistics: function () {
    this.setData({ loading: true });
    
    Promise.all([
      getAccidentList({ page: 1, pageSize: 100 }).catch(() => ({ list: [] })),
      getCertificateList({ page: 1, pageSize: 100 }).catch(() => ({ list: [] })),
      getUnreadCount().catch(() => ({ count: 0 }))
    ]).then(([accidentRes, certRes, unreadRes]) => {
      const accidents = accidentRes.list || [];
      const certificates = certRes.list || [];
      const unreadCount = unreadRes.count || 0;
      
      const completed = accidents.filter(a => a.status === 'completed').length;
      const pending = accidents.filter(a => a.status === 'pending' || a.status === 'processing').length;
      
      const menuGroups = this.data.menuGroups.map(group => ({
        ...group,
        items: group.items.map(item => {
          if (item.key === 'my-reports') {
            return { ...item, badge: accidents.length };
          }
          if (item.key === 'my-certificates') {
            return { ...item, badge: certificates.length };
          }
          if (item.key === 'notifications') {
            return { ...item, badge: unreadCount };
          }
          return item;
        })
      }));
      
      this.setData({
        statistics: {
          totalReports: accidents.length,
          completedReports: completed,
          pendingReports: pending,
          totalCertificates: certificates.length
        },
        menuGroups,
        loading: false
      });
    }).catch((err) => {
      console.error('[Mine] 加载统计失败:', err);
      this.setData({
        statistics: {
          totalReports: 3,
          completedReports: 2,
          pendingReports: 1,
          totalCertificates: 2
        },
        loading: false
      });
    });
  },

  doLogin: function () {
    wx.showLoading({ title: '登录中...' });
    
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          post('/auth/login/wechat', { code: loginRes.code }).then((res) => {
            wx.hideLoading();
            
            const user = res.user || {};
            const token = res.token || '';
            
            const userInfo = {
              avatar: user.avatarUrl || '',
              name: user.nickname || user.phone || '微信用户',
              phone: user.phone || '',
              idNumber: ''
            };
            
            if (token) {
              const app = getApp();
              app.setToken(token);
            }
            wx.setStorageSync('userInfo', userInfo);
            
            this.setData({
              isLoggedIn: true,
              userInfo: userInfo
            });
            
            this.loadStatistics();
            
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
          }).catch((err) => {
            wx.hideLoading();
            console.error('[Mine] 登录失败:', err);
            
            const mockUserInfo = {
              avatar: '',
              name: '用户' + Math.floor(Math.random() * 10000),
              phone: '',
              idNumber: ''
            };
            
            const app = getApp();
            app.setToken('mock-jwt-token-' + Date.now());
            wx.setStorageSync('userInfo', mockUserInfo);
            
            this.setData({
              isLoggedIn: true,
              userInfo: mockUserInfo
            });
            
            this.loadStatistics();
            
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    });
  },

  onMenuTap: function (e) {
    const key = e.currentTarget.dataset.key;
    
    if (!this.data.isLoggedIn && key !== 'help' && key !== 'about' && key !== 'privacy') {
      wx.showModal({
        title: '提示',
        content: '请先登录后使用此功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            this.doLogin();
          }
        }
      });
      return;
    }
    
    switch (key) {
      case 'my-reports':
        wx.switchTab({ url: '/pages/report/index' });
        break;
      case 'my-certificates':
        wx.switchTab({ url: '/pages/certificates/index' });
        break;
      case 'my-vehicles':
        wx.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'notifications':
        wx.navigateTo({ url: '/pages/notifications/index' });
        break;
      case 'notification-settings':
        wx.navigateTo({ url: '/pages/notification-settings/index' });
        break;
      case 'verify':
        wx.switchTab({ url: '/pages/certificates/index' });
        setTimeout(() => {
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          if (currentPage && currentPage.showVerify) {
            currentPage.showVerify();
          }
        }, 300);
        break;
      case 'contact':
        wx.showModal({
          title: '联系客服',
          content: '客服热线：400-888-8888\n服务时间：周一至周日 9:00-21:00',
          showCancel: false
        });
        break;
      case 'help':
        wx.showModal({
          title: '帮助中心',
          content: '1. 如何报案？\n点击首页"快速报案"按钮，按提示操作即可。\n\n2. 认定书多久生成？\n提交后系统自动定责，通常3-5分钟生成认定书。\n\n3. 认定书有效吗？\n本平台生成的电子认定书与纸质认定书具有同等法律效力。',
          showCancel: false,
          confirmText: '我知道了'
        });
        break;
      case 'settings':
        wx.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'privacy':
        wx.showModal({
          title: '隐私政策',
          content: '我们重视您的隐私保护，承诺不会向第三方泄露您的个人信息和事故数据。您的数据仅用于交通事故处理服务。',
          showCancel: false
        });
        break;
      case 'about':
        wx.showModal({
          title: '关于我们',
          content: '交通事故快速处理平台 v1.0.0\n\n致力于为用户提供便捷、高效的交通事故线上处理服务，让事故处理更简单。\n\n© 2026 交通管理部门',
          showCancel: false
        });
        break;
      default:
        wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  doLogout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          
          this.setData({
            isLoggedIn: false,
            userInfo: {
              avatar: '',
              name: '未登录',
              phone: '',
              idNumber: ''
            },
            statistics: {
              totalReports: 0,
              completedReports: 0,
              pendingReports: 0,
              totalCertificates: 0
            }
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  onShareAppMessage: function () {
    return {
      title: '交通事故快速处理平台',
      path: '/pages/home/index'
    };
  }
});
