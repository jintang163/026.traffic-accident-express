const { getNotifications, markAsRead, markAllAsRead, getNotificationTypeText } = require('../../services/notification');

Page({
  data: {
    notifications: [],
    unreadCount: 0,
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    hasMore: true,
    currentType: '',
    typeOptions: [
      { label: '全部', value: '' },
      { label: '定责通知', value: 'liability_determined' },
      { label: '认定书', value: 'certificate_generated' },
      { label: '复核结果', value: 'appeal_result' },
      { label: '证据提醒', value: 'evidence_supplement_reminder' },
      { label: '系统通知', value: 'system_notice' },
    ],
  },

  onLoad: function (options) {
    this.loadNotifications();
    this.loadUnreadCount();
  },

  onShow: function () {
    this.loadUnreadCount();
  },

  onPullDownRefresh: function () {
    this.setData({ page: 1, hasMore: true });
    this.loadNotifications().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  loadNotifications: async function () {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const res = await getNotifications({
        page: this.data.page,
        pageSize: this.data.pageSize,
        type: this.data.currentType,
      });

      const list = (res.list || []).map((item) => ({
        ...item,
        typeText: getNotificationTypeText(item.type),
        timeText: this.formatTime(item.createdAt),
      }));

      if (this.data.page === 1) {
        this.setData({
          notifications: list,
          total: res.total || 0,
          hasMore: list.length >= this.data.pageSize,
        });
      } else {
        this.setData({
          notifications: [...this.data.notifications, ...list],
          hasMore: list.length >= this.data.pageSize,
        });
      }
    } catch (err) {
      console.error('[Notifications] 加载失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  loadMore: function () {
    this.setData({ page: this.data.page + 1 });
    this.loadNotifications();
  },

  loadUnreadCount: async function () {
    try {
      const res = await getUnreadCount();
      this.setData({ unreadCount: res.count || 0 });
    } catch (err) {
      console.error('[Notifications] 获取未读数失败:', err);
    }
  },

  onTypeChange: function (e) {
    const type = e.currentTarget.dataset.value;
    this.setData({ currentType: type, page: 1, hasMore: true });
    this.loadNotifications();
  },

  onItemTap: function (e) {
    const item = e.currentTarget.dataset.item;

    if (!item.isRead) {
      markAsRead(item.id).catch(() => {});
      const notifications = this.data.notifications.map((n) =>
        n.id === item.id ? { ...n, isRead: true } : n
      );
      this.setData({ notifications, unreadCount: Math.max(0, this.data.unreadCount - 1) });
    }

    if (item.pagePath) {
      const url = item.pagePath + (item.pagePath.includes('?') ? '&' : '?') + 'id=' + item.accidentId;
      wx.navigateTo({
        url: url,
        fail: () => {
          console.log('[Notifications] 页面跳转失败:', url);
        },
      });
    }
  },

  onMarkAllRead: async function () {
    try {
      await markAllAsRead();
      const notifications = this.data.notifications.map((n) => ({ ...n, isRead: true }));
      this.setData({ notifications, unreadCount: 0 });
      wx.showToast({ title: '已全部标为已读', icon: 'success' });
    } catch (err) {
      console.error('[Notifications] 全部标为已读失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  formatTime: function (dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return '刚刚';
    } else if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + '分钟前';
    } else if (diff < 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 60 * 1000)) + '小时前';
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (24 * 60 * 60 * 1000)) + '天前';
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return month + '-' + day;
    }
  },
});
