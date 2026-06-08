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
