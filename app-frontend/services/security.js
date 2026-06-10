const { get, post } = require('../utils/request');

function sendSmsCode(phone, action = 'appeal') {
  console.log('[Security] 发送短信验证码:', phone, action);
  return post('/security/sms/send', { phone, action });
}

function verifySmsCode(phone, code, action = 'appeal') {
  console.log('[Security] 校验短信验证码:', phone, action);
  return post('/security/sms/verify', { phone, code, action });
}

function startFaceVerify(phone) {
  console.log('[Security] 发起人脸核身');
  return post('/security/face/start', { phone });
}

function mockFaceVerifyPass(transactionId) {
  console.log('[Security] Mock人脸核身通过:', transactionId);
  return post('/security/face/mock-pass', { transactionId });
}

function verifySecurityToken(token) {
  console.log('[Security] 校验安全令牌');
  return post('/security/token/verify', { token });
}

module.exports = {
  sendSmsCode,
  verifySmsCode,
  startFaceVerify,
  mockFaceVerifyPass,
  verifySecurityToken,
};
