const { get, post } = require('../utils/request');

function getCertificateList(params = {}) {
  console.log('[Certificate] 获取认定书列表:', params);
  return get('/certificate/list', params);
}

function getCertificateDetail(id) {
  console.log('[Certificate] 获取认定书详情:', id);
  return get(`/certificate/${id}`);
}

function generateCertificate(accidentId) {
  console.log('[Certificate] 生成认定书:', accidentId);
  return post('/certificate/generate', { accidentId });
}

function verifyCertificate(certificateNumber) {
  console.log('[Certificate] 核验认定书:', certificateNumber);
  return post('/certificate/verify', { certificateNumber });
}

function shareCertificate(id) {
  console.log('[Certificate] 分享认定书:', id);
  return post(`/certificate/${id}/share`, {});
}

function downloadCertificate(id) {
  console.log('[Certificate] 下载认定书:', id);
  return get(`/certificate/${id}/download`);
}

function getCertificateStatistics() {
  console.log('[Certificate] 获取认定书统计');
  return get('/certificate/statistics');
}

function printCertificate(id) {
  console.log('[Certificate] 打印认定书:', id);
  return get(`/certificate/${id}/print`);
}

function sendCertificate(id, phone) {
  console.log('[Certificate] 发送认定书:', id, phone);
  return post(`/certificate/${id}/send`, { phone });
}

module.exports = {
  getCertificateList,
  getCertificateDetail,
  generateCertificate,
  verifyCertificate,
  shareCertificate,
  downloadCertificate,
  getCertificateStatistics,
  printCertificate,
  sendCertificate
};
