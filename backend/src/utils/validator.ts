export const getAccidentTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    rear_end: '追尾',
    side_swipe: '剐蹭',
    head_on: '正面碰撞',
    reverse: '倒车事故',
    intersection: '路口事故',
    other: '其他'
  };
  return typeMap[type] || type;
};

export const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    rejected: '已驳回',
    draft: '草稿',
    issued: '已出具',
    verified: '已核验',
    revoked: '已撤销'
  };
  return statusMap[status] || status;
};

export const validatePlateNo = (plateNo: string): boolean => {
  if (!plateNo || plateNo.length < 7 || plateNo.length > 8) {
    return false;
  }
  
  const plateRegex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/;
  return plateRegex.test(plateNo);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

export const validateDriverLicenseNo = (licenseNo: string): boolean => {
  if (!licenseNo) return true;
  const licenseRegex = /^\d{12,18}$/;
  return licenseRegex.test(licenseNo);
};

export const validateTimeNotFuture = (timeStr: string): boolean => {
  if (!timeStr) return false;
  const inputTime = new Date(timeStr).getTime();
  if (isNaN(inputTime)) return false;
  return inputTime <= Date.now();
};

export const validateAccidentReport = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.accidentType) {
    errors.push('事故类型不能为空');
  }

  if (!data.accidentTime && !data.occurTime) {
    errors.push('事故时间不能为空');
  } else {
    const timeStr = data.accidentTime || data.occurTime;
    if (!validateTimeNotFuture(timeStr)) {
      errors.push('事故时间不能晚于当前时间');
    }
  }

  if (!data.location) {
    errors.push('事故地点不能为空');
  }

  if (!data.integrityConfirmed) {
    errors.push('必须确认诚信申报承诺');
  }

  if (data.driverA) {
    if (!data.driverA.phone || !validatePhone(data.driverA.phone)) {
      errors.push('A车驾驶员手机号格式不正确');
    }
    if (data.driverA.license && !validateDriverLicenseNo(data.driverA.license)) {
      errors.push('A车驾驶证号格式不正确');
    }
  }

  if (data.driverB) {
    if (!data.driverB.phone || !validatePhone(data.driverB.phone)) {
      errors.push('B车驾驶员手机号格式不正确');
    }
    if (data.driverB.license && !validateDriverLicenseNo(data.driverB.license)) {
      errors.push('B车驾驶证号格式不正确');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
