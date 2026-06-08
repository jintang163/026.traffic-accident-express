export interface UserInfo {
  id: string;
  openid: string;
  nickname: string;
  avatarUrl: string;
  phone: string;
  idCardNo: string;
  realName: string;
  isVerified: boolean;
  createdAt: string;
}

export interface UserSettings {
  enablePushNotification: boolean;
  enableLocation: boolean;
  language: 'zh-CN' | 'en';
}
