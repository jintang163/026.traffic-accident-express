import request from './request';

export const login = (data: { username: string; password: string }) =>
  request.post('/auth/login', data);

export const getStatistics = () => request.get('/accident/statistics');

export const getAccidentList = (params: any) => request.get('/accident/list', { params });

export const getAccidentDetail = (id: string) => request.get(`/accident/${id}`);

export const determineLiability = (id: string, data: any) =>
  request.post(`/accident/${id}/determine-liability`, data);

export const getCertificateList = (params: any) => request.get('/certificate/list', { params });

export const getCertificateDetail = (id: string) => request.get(`/certificate/${id}`);

export const verifyCertificate = (certificateNumber: string, verifyCode?: string) =>
  request.post('/certificate/verify', verifyCode
    ? { certificateNo: certificateNumber, verifyCode }
    : { certificateNumber });

export const generateCertificate = (accidentId: string) =>
  request.post('/certificate/generate', { accidentId });

export const getOcrList = (params: any) => request.get('/ocr/list', { params });

export const getUserList = (params: any) => request.get('/user/list', { params });

// Admin APIs

export const adminGetAccidentList = (params: any) =>
  request.get('/admin/accidents', { params });

export const adminOverrideLiability = (id: string, data: any) =>
  request.put(`/admin/accidents/${id}/liability`, data);

export const adminGetEvidence = (id: string) =>
  request.get(`/admin/accidents/${id}/evidence`);

export const adminGetAccidentAuditLogs = (id: string) =>
  request.get(`/admin/accidents/${id}/audit-logs`);

export const adminGetAppealList = (params: any) =>
  request.get('/admin/appeals', { params });

export const adminGetAppealDetail = (id: string) =>
  request.get(`/admin/appeals/${id}`);

export const adminReviewAppeal = (id: string, data: any) =>
  request.put(`/admin/appeals/${id}/review`, data);

export const adminBatchExportCertificates = (ids: string[]) =>
  request.post('/admin/certificates/batch-export', { ids });

export const adminGetCertificatePdfUrl = (id: string) =>
  request.get(`/admin/certificates/${id}/pdf-url`);

export const adminPushToPolice = (accidentId: string) =>
  request.post(`/admin/push/${accidentId}`);

export const adminGetDashboardStatistics = (days?: number) =>
  request.get('/admin/dashboard/statistics', { params: { days } });

export const adminGetDailyTrend = (days?: number) =>
  request.get('/admin/dashboard/daily-trend', { params: { days } });

export const adminGetTypeDistribution = () =>
  request.get('/admin/dashboard/type-distribution');

export const getAuditLogList = (params: any) =>
  request.get('/audit-log/list', { params });

export const getAuditLogByAccident = (accidentId: string) =>
  request.get(`/audit-log/by-accident/${accidentId}`);

export const getRecentAuditLogs = (count?: number) =>
  request.get('/audit-log/recent', { params: { count } });
