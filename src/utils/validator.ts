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

export const validateIdCard = (idCard: string): boolean => {
  if (!idCard || idCard.length !== 18) {
    return false;
  }
  
  const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  if (!idCardRegex.test(idCard)) {
    return false;
  }
  
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCard[i]) * weights[i];
  }
  
  const checkCode = checkCodes[sum % 11];
  return checkCode === idCard[17].toUpperCase();
};

export const validateRequired = (value: string | any[]): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return !!value && value.toString().trim().length > 0;
};

export const getPlateNoErrorMessage = (plateNo: string): string => {
  if (!plateNo) {
    return '请输入车牌号';
  }
  if (plateNo.length < 7 || plateNo.length > 8) {
    return '车牌号长度不正确';
  }
  if (!validatePlateNo(plateNo)) {
    return '请输入正确的车牌号';
  }
  return '';
};

export const getPhoneErrorMessage = (phone: string): string => {
  if (!phone) {
    return '请输入手机号';
  }
  if (!validatePhone(phone)) {
    return '请输入正确的手机号';
  }
  return '';
};

export const getPlateColorText = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: '蓝色',
    yellow: '黄色',
    green: '绿色',
    black: '黑色',
    white: '白色',
    other: '其他'
  };
  return colorMap[color] || color;
};

export const getAccidentTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    rear_end: '追尾',
    side_swipe: '剐蹭',
    head_on: '正面碰撞',
    reverse: '倒车事故',
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
