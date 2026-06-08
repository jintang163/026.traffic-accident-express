const { uploadFile, post } = require('../utils/request');

function recognizePlate(imagePath) {
  const startTime = Date.now();
  console.log('[OCR] 开始车牌识别, 图片:', imagePath);
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn('[OCR] 识别耗时超过15秒!');
    }, 15000);

    uploadFile({
      url: '/ocr/plate',
      filePath: imagePath,
      name: 'image',
      data: {}
    }).then((result) => {
      const duration = Date.now() - startTime;
      console.log('[OCR] 车牌识别完成, 耗时:', duration + 'ms');
      
      if (duration > 15000) {
        console.warn('[OCR] 识别耗时超过15秒, 实际耗时:', duration + 'ms');
      }
      
      clearTimeout(timeoutId);
      resolve(result);
    }).catch((err) => {
      console.error('[OCR] 车牌识别失败:', err);
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

function recognizePlateByUrl(imageUrl) {
  const startTime = Date.now();
  console.log('[OCR] 开始URL车牌识别:', imageUrl);
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn('[OCR] 识别耗时超过15秒!');
    }, 15000);

    post('/ocr/plate-url', {
      imageUrl: imageUrl
    }).then((result) => {
      const duration = Date.now() - startTime;
      console.log('[OCR] URL车牌识别完成, 耗时:', duration + 'ms');
      
      if (duration > 15000) {
        console.warn('[OCR] 识别耗时超过15秒, 实际耗时:', duration + 'ms');
      }
      
      clearTimeout(timeoutId);
      resolve(result);
    }).catch((err) => {
      console.error('[OCR] URL车牌识别失败:', err);
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

function mockRecognizePlate() {
  console.log('[OCR] 使用Mock数据');
  
  const plates = [
    { plateNumber: '京A12345', plateColor: '蓝', confidence: 0.98 },
    { plateNumber: '沪B67890', plateColor: '蓝', confidence: 0.95 },
    { plateNumber: '粤C11111', plateColor: '黄', confidence: 0.92 },
    { plateNumber: '浙D22222', plateColor: '蓝', confidence: 0.97 },
    { plateNumber: '苏E33333', plateColor: '绿', confidence: 0.94 }
  ];
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = plates[Math.floor(Math.random() * plates.length)];
      console.log('[OCR] Mock识别结果:', result);
      resolve(result);
    }, 2000);
  });
}

module.exports = {
  recognizePlate,
  recognizePlateByUrl,
  mockRecognizePlate
};
