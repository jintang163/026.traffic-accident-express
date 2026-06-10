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

function verifyCertificate(certificateNo, verifyCode) {
  console.log('[Certificate] 核验认定书:', certificateNo);
  return post('/certificate/verify', { certificateNo, verifyCode });
}

function shareCertificate(id) {
  console.log('[Certificate] 分享认定书:', id);
  return post(`/certificate/${id}/share`, {});
}

function downloadCertificate(id) {
  console.log('[Certificate] 下载认定书:', id);
  return get(`/certificate/${id}/download`);
}

function downloadCertificatePdf(id) {
  const baseUrl = getApp().globalData.baseUrl || 'http://localhost:3000/api';
  return `${baseUrl}/certificate/${id}/pdf`;
}

function regenerateCertificatePdf(id) {
  console.log('[Certificate] 重新生成PDF:', id);
  return post(`/certificate/${id}/regenerate-pdf`, {});
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
  downloadCertificatePdf,
  regenerateCertificatePdf,
  getCertificateStatistics,
  printCertificate,
  sendCertificate
};
