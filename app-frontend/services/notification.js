const { get, post, put } = require('../utils/request');

const NOTIFICATION_TYPE_MAP = {
  liability_determined: '定责完成通知',
  certificate_generated: '认定书生成通知',
  appeal_result: '复核结果通知',
  evidence_supplement_reminder: '证据补充提醒',
  system_notice: '系统通知',
};

const TEMPLATE_TYPE_CONFIG = {
  liability_determined: {
    title: '定责完成通知',
    desc: '事故责任判定完成后第一时间通知您',
    defaultTemplateId: 'TMPL_LIABILITY',
  },
  certificate_generated: {
    title: '认定书生成通知',
    desc: '事故认定书生成后及时提醒您查看',
    defaultTemplateId: 'TMPL_CERTIFICATE',
  },
  appeal_result: {
    title: '复核结果通知',
    desc: '申诉复核完成后第一时间通知结果',
    defaultTemplateId: 'TMPL_APPEAL',
  },
  evidence_supplement_reminder: {
    title: '证据补充提醒',
    desc: '需要补充证据材料时及时提醒',
    defaultTemplateId: 'TMPL_EVIDENCE',
  },
};

function getNotificationTypeText(type) {
  return NOTIFICATION_TYPE_MAP[type] || '通知';
}

function getTemplateConfig() {
  return TEMPLATE_TYPE_CONFIG;
}

async function getNotifications(params = {}) {
  const { page = 1, pageSize = 20, type, isRead } = params;
  const query = [];
  query.push(`page=${page}`);
  query.push(`pageSize=${pageSize}`);
  if (type) query.push(`type=${type}`);
  if (isRead !== undefined) query.push(`isRead=${isRead}`);

  return get(`/notification?${query.join('&')}`);
}

async function getUnreadCount() {
  return get('/notification/unread-count');
}

async function markAsRead(id) {
  return post('/notification/mark-read', { id });
}

async function markAllAsRead() {
  return post('/notification/mark-read', { all: true });
}

async function retryNotification(id) {
  return post(`/notification/retry/${id}`);
}

async function getSubscriptions() {
  return get('/notification/subscriptions');
}

async function subscribeTemplate(templateType, templateId, wechatEnabled = true, smsEnabled = true) {
  return post('/notification/subscriptions', {
    templateType,
    templateId,
    wechatEnabled,
    smsEnabled,
  });
}

async function updateSubscription(id, data) {
  return put(`/notification/subscriptions/${id}`, data);
}

async function getTemplateConfigApi() {
  return get('/notification/templates/config');
}

function requestSubscribeMessage(templateIds) {
  return new Promise((resolve, reject) => {
    if (!wx.requestSubscribeMessage) {
      reject(new Error('微信版本不支持订阅消息'));
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success: (res) => {
        resolve(res);
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

async function subscribeAndAuthorize(templateType, templateId) {
  try {
    const result = await requestSubscribeMessage([templateId]);
    const acceptStatus = result[templateId];

    if (acceptStatus === 'accept') {
      await subscribeTemplate(templateType, templateId, true, true);
      return { success: true, accepted: true };
    } else {
      return { success: true, accepted: false, status: acceptStatus };
    }
  } catch (error) {
    console.error('[Notification] 订阅授权失败:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  NOTIFICATION_TYPE_MAP,
  TEMPLATE_TYPE_CONFIG,
  getNotificationTypeText,
  getTemplateConfig,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  retryNotification,
  getSubscriptions,
  subscribeTemplate,
  updateSubscription,
  getTemplateConfigApi,
  requestSubscribeMessage,
  subscribeAndAuthorize,
};
