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
