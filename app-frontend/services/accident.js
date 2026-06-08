const { get, post, uploadFile } = require('../utils/request');

function getAccidentList(params = {}) {
  console.log('[Accident] 获取事故列表:', params);
  return get('/accident/list', params);
}

function getAccidentDetail(id) {
  console.log('[Accident] 获取事故详情:', id);
  return get(`/accident/${id}`);
}

function createAccident(data) {
  console.log('[Accident] 创建事故报告:', data);
  return post('/accident/report', data);
}

function uploadPhoto(filePath, accidentId, photoType = 'scene') {
  console.log('[Accident] 上传照片:', { filePath, accidentId, photoType });
  return uploadFile({
    url: '/accident/upload-photo',
    filePath: filePath,
    name: 'photo',
    data: {
      accidentId: accidentId,
      type: photoType
    }
  });
}

function uploadPhotos(filePaths, accidentId, photoType = 'scene') {
  return new Promise(async (resolve, reject) => {
    const results = [];
    for (let i = 0; i < filePaths.length; i++) {
      try {
        const result = await uploadPhoto(filePaths[i], accidentId, photoType);
        results.push(result);
      } catch (err) {
        console.error('[Accident] 批量上传照片失败:', err);
        reject(err);
        return;
      }
    }
    resolve(results);
  });
}

function submitReport(data) {
  console.log('[Accident] 提交完整事故报告:', data);
  
  return new Promise(async (resolve, reject) => {
    try {
      const reportData = {
        accidentType: data.accidentType,
        accidentTime: data.accidentTime,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description,
        weather: data.weather,
        roadCondition: data.roadCondition,
        vehicles: data.vehicles || [],
        driverA: data.driverA,
        driverB: data.driverB
      };
      
      console.log('[Accident] Step1: 创建事故记录');
      const accident = await createAccident(reportData);
      console.log('[Accident] 事故记录创建成功:', accident.id);
      
      if (data.photos && data.photos.length > 0) {
        console.log('[Accident] Step2: 上传现场照片, 共', data.photos.length, '张');
        await uploadPhotos(data.photos, accident.id, 'scene');
        console.log('[Accident] 现场照片上传完成');
      }
      
      if (data.platePhotos && data.platePhotos.length > 0) {
        console.log('[Accident] Step3: 上传车牌照片, 共', data.platePhotos.length, '张');
        await uploadPhotos(data.platePhotos, accident.id, 'plate');
        console.log('[Accident] 车牌照片上传完成');
      }
      
      console.log('[Accident] Step4: 自动责任判定');
      const liabilityResult = await determineLiability(accident.id);
      console.log('[Accident] 责任判定完成:', liabilityResult);
      
      console.log('[Accident] Step5: 生成电子认定书');
      const certificate = await generateCertificate(accident.id);
      console.log('[Accident] 认定书生成完成:', certificate.id);
      
      resolve({
        accident: accident,
        liability: liabilityResult,
        certificate: certificate
      });
    } catch (err) {
      console.error('[Accident] 提交报告失败:', err);
      reject(err);
    }
  });
}

function determineLiability(accidentId) {
  console.log('[Accident] 责任判定:', accidentId);
  return post(`/accident/${accidentId}/determine-liability`, {});
}

function updateAccident(id, data) {
  console.log('[Accident] 更新事故:', id, data);
  return post(`/accident/${id}`, data);
}

function deleteAccident(id) {
  console.log('[Accident] 删除事故:', id);
  return post(`/accident/${id}/delete`, {});
}

function generateCertificate(accidentId) {
  console.log('[Accident] 生成认定书:', accidentId);
  return post('/certificate/generate', { accidentId: accidentId });
}

function getAccidentStatistics() {
  console.log('[Accident] 获取统计数据');
  return get('/accident/statistics');
}

module.exports = {
  getAccidentList,
  getAccidentDetail,
  createAccident,
  uploadPhoto,
  uploadPhotos,
  submitReport,
  determineLiability,
  updateAccident,
  deleteAccident,
  generateCertificate,
  getAccidentStatistics
};
