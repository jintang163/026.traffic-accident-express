const { get, post, put, uploadFile } = require('../utils/request');

function createAppeal(data) {
  console.log('[Appeal] 创建申诉:', data);
  return post('/appeal/create', data);
}

function getAppealList(params = {}) {
  console.log('[Appeal] 获取申诉列表:', params);
  return get('/appeal/list', params);
}

function getAppealDetail(id) {
  console.log('[Appeal] 获取申诉详情:', id);
  return get(`/appeal/${id}`);
}

function getAppealByAccidentId(accidentId) {
  console.log('[Appeal] 根据事故ID获取申诉:', accidentId);
  return get(`/appeal/by-accident/${accidentId}`);
}

function reviewAppeal(id, data) {
  console.log('[Appeal] 审核申诉:', id, data);
  return put(`/appeal/${id}/review`, data);
}

function withdrawAppeal(id) {
  console.log('[Appeal] 撤回申诉:', id);
  return put(`/appeal/${id}/withdraw`, {});
}

function getAppealStatistics() {
  console.log('[Appeal] 获取申诉统计');
  return get('/appeal/statistics');
}

function uploadAppealEvidence(filePath, name = 'evidence') {
  console.log('[Appeal] 上传申诉证据:', filePath);
  return uploadFile({
    url: '/evidence/upload',
    filePath: filePath,
    name: name,
  });
}

module.exports = {
  createAppeal,
  getAppealList,
  getAppealDetail,
  getAppealByAccidentId,
  reviewAppeal,
  withdrawAppeal,
  getAppealStatistics,
  uploadAppealEvidence,
};
