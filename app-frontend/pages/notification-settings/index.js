const {
  getSubscriptions,
  subscribeAndAuthorize,
  updateSubscription,
  getTemplateConfig,
  getTemplateConfigApi,
} = require('../../services/notification');

Page({
  data: {
    subscriptions: [],
    templateConfig: {},
    templateTypes: [],
    loading: false,
  },

  onLoad: function () {
    this.loadTemplateConfig();
    this.loadSubscriptions();
  },

  onShow: function () {
    this.loadSubscriptions();
  },

  loadTemplateConfig: async function () {
    try {
      const localConfig = getTemplateConfig();
      this.setData({
        templateConfig: localConfig,
        templateTypes: Object.keys(localConfig),
      });

      try {
        const apiConfig = await getTemplateConfigApi();
        if (apiConfig) {
          const mergedConfig = { ...localConfig };
          for (const key of Object.keys(apiConfig)) {
            if (mergedConfig[key]) {
              mergedConfig[key].defaultTemplateId = apiConfig[key].defaultTemplateId || mergedConfig[key].defaultTemplateId;
            }
          }
          this.setData({ templateConfig: mergedConfig });
        }
      } catch (err) {
        console.log('[NotificationSettings] 使用本地模板配置');
      }
    } catch (err) {
      console.error('[NotificationSettings] 加载模板配置失败:', err);
    }
  },

  loadSubscriptions: async function () {
    this.setData({ loading: true });

    try {
      const res = await getSubscriptions();
      const subscriptions = res.subscriptions || [];

      const subscriptionMap = {};
      subscriptions.forEach((sub) => {
        subscriptionMap[sub.templateType] = sub;
      });

      this.setData({
        subscriptions: subscriptions,
        subscriptionMap,
      });
    } catch (err) {
      console.error('[NotificationSettings] 加载订阅列表失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSubscribe: async function (e) {
    const templateType = e.currentTarget.dataset.type;
    const config = this.data.templateConfig[templateType];

    if (!config) return;

    const templateId = config.defaultTemplateId;

    wx.showLoading({ title: '授权中...' });

    try {
      const result = await subscribeAndAuthorize(templateType, templateId);

      wx.hideLoading();

      if (result.success && result.accepted) {
        wx.showToast({ title: '订阅成功', icon: 'success' });
        this.loadSubscriptions();
      } else if (result.success && !result.accepted) {
        wx.showToast({ title: '您取消了订阅授权', icon: 'none' });
      } else {
        wx.showToast({ title: '订阅失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[NotificationSettings] 订阅失败:', err);
      wx.showToast({ title: '订阅失败: ' + (err.message || ''), icon: 'none' });
    }
  },

  onToggleWechat: async function (e) {
    const item = e.currentTarget.dataset.item;
    const newValue = !item.wechatEnabled;

    try {
      await updateSubscription(item.id, { wechatEnabled: newValue });

      const subscriptions = this.data.subscriptions.map((sub) =>
        sub.id === item.id ? { ...sub, wechatEnabled: newValue } : sub
      );

      const subscriptionMap = { ...this.data.subscriptionMap };
      subscriptionMap[item.templateType] = {
        ...subscriptionMap[item.templateType],
        wechatEnabled: newValue,
      };

      this.setData({ subscriptions, subscriptionMap });

      wx.showToast({
        title: newValue ? '微信通知已开启' : '微信通知已关闭',
        icon: 'none',
      });
    } catch (err) {
      console.error('[NotificationSettings] 更新订阅失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onToggleSms: async function (e) {
    const item = e.currentTarget.dataset.item;
    const newValue = !item.smsEnabled;

    try {
      await updateSubscription(item.id, { smsEnabled: newValue });

      const subscriptions = this.data.subscriptions.map((sub) =>
        sub.id === item.id ? { ...sub, smsEnabled: newValue } : sub
      );

      const subscriptionMap = { ...this.data.subscriptionMap };
      subscriptionMap[item.templateType] = {
        ...subscriptionMap[item.templateType],
        smsEnabled: newValue,
      };

      this.setData({ subscriptions, subscriptionMap });

      wx.showToast({
        title: newValue ? '短信通知已开启' : '短信通知已关闭',
        icon: 'none',
      });
    } catch (err) {
      console.error('[NotificationSettings] 更新订阅失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  isSubscribed: function (templateType) {
    return !!this.data.subscriptionMap?.[templateType];
  },

  getSubscription: function (templateType) {
    return this.data.subscriptionMap?.[templateType] || null;
  },
});
