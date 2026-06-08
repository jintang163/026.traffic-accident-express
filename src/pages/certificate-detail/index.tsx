import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { getCurrentPages, showToast, shareAppMessage } from '@tarojs/taro';
import styles from './index.module.scss';
import { mockAccidents } from '@/data/mockAccident';
import { CertificateInfo } from '@/types/certificate';
import { formatDateTime, getAccidentTypeText } from '@/utils/validator';

const actions = [
  { id: 'download', icon: '📥', text: '下载PDF' },
  { id: 'share', icon: '🔗', text: '分享' },
  { id: 'print', icon: '🖨️', text: '打印' },
  { id: 'verify', icon: '✅', text: '核验' },
];

const mockCertificate: CertificateInfo = {
  id: 'cert_001',
  certificateNo: 'SD202401150001',
  accidentId: 'acc_001',
  accidentType: 'rear_end',
  liabilityResult: {
    primaryParty: 'A车',
    secondaryParty: 'B车',
    primaryRatio: 100,
    secondaryRatio: 0,
    description: '后车未保持安全车距，负全部责任',
    ruleBasis: '《道路交通安全法》第四十三条',
  },
  generatedAt: new Date().toISOString(),
  status: 'verified',
  verifyCode: 'ABC123',
  pdfUrl: '',
  sharedCount: 5,
  accidentInfo: mockAccidents[0],
};

export default function CertificateDetail() {
  const [certificate, setCertificate] = useState<CertificateInfo | null>(null);

  useEffect(() => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    const options = currentPage?.options || {};
    
    setCertificate(mockCertificate);
  }, []);

  const handleAction = (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    showToast({ 
      title: action ? `${action.text}功能开发中` : '功能开发中', 
      icon: 'none' 
    });
  };

  const handleContactInsurance = () => {
    showToast({ title: '已通知保险公司', icon: 'success' });
  };

  const handleApplyReview = () => {
    showToast({ title: '申请复核功能开发中', icon: 'none' });
  };

  const handleShare = () => {
    shareAppMessage({
      title: '交通事故认定书',
      path: '/pages/certificate-detail/index?id=' + certificate?.id,
    });
  };

  if (!certificate || !certificate.accidentInfo) {
    return (
      <View className={styles.container}>
        <View className={styles.content}>
          <Text style={{ textAlign: 'center', display: 'block', padding: '100rpx 0' }}>
            加载中...
          </Text>
        </View>
      </View>
    );
  }

  const accident = certificate.accidentInfo;

  return (
    <View className={styles.container}>
      <View className={styles.certificateHeader}>
        <Text className={styles.certificateIcon}>📜</Text>
        <Text className={styles.certificateTitle}>道路交通事故认定书</Text>
        <Text className={styles.certificateSubtitle}>
          编号：{certificate.certificateNo}
        </Text>
      </View>

      <View className={styles.content}>
        <View className={styles.certificateCard}>
          <View className={styles.certificateSeal}>
            <Text className={styles.sealText}>交通管理专用章</Text>
          </View>
          
          <View className={styles.cardSection}>
            <Text className={styles.cardSectionTitle}>
              📋 事故基本信息
            </Text>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>事故类型</Text>
              <Text className={styles.infoValue}>{getAccidentTypeText(certificate.accidentType)}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>发生时间</Text>
              <Text className={styles.infoValue}>{formatDateTime(accident.occurTime)}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>发生地点</Text>
              <Text className={styles.infoValue}>{accident.location?.address || '未知'}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>认定时间</Text>
              <Text className={styles.infoValue}>{formatDateTime(certificate.generatedAt)}</Text>
            </View>
          </View>

          <View className={styles.cardSection}>
            <Text className={styles.cardSectionTitle}>
              🚗 当事人信息
            </Text>
            {accident.vehicles.map((vehicle, index) => (
              <View key={index} style={{ marginBottom: index < accident.vehicles.length - 1 ? '24rpx' : 0 }}>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>{index === 0 ? 'A车' : 'B车'}</Text>
                  <Text className={styles.infoValue}>
                    {vehicle.plate?.plateNo || '-'}{vehicle.plate?.plateColor ? `(${vehicle.plate.plateColor})` : ''}
                  </Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>车主</Text>
                  <Text className={styles.infoValue}>{vehicle.ownerName || '-'}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className={styles.cardSection}>
            <Text className={styles.cardSectionTitle}>
              ⚖️ 责任认定
            </Text>
            <View className={styles.liabilityBox}>
              <Text className={styles.liabilityText}>
                {certificate.liabilityResult.description}
              </Text>
              <View className={styles.liabilitySplit}>
                <View className={styles.liabilityParty}>
                  <Text className={styles.partyName}>A车</Text>
                  <Text className={styles.partyPlate}>{accident.vehicles[0]?.plate?.plateNo || '-'}</Text>
                  <Text className={styles.partyRatio}>{certificate.liabilityResult.primaryRatio}%</Text>
                </View>
                <View className={styles.liabilityParty}>
                  <Text className={styles.partyName}>B车</Text>
                  <Text className={styles.partyPlate}>{accident.vehicles[1]?.plate?.plateNo || '-'}</Text>
                  <Text className={styles.partyRatio}>{certificate.liabilityResult.secondaryRatio}%</Text>
                </View>
              </View>
            </View>
          </View>

          {certificate.liabilityResult.ruleBasis && (
            <View className={styles.cardSection}>
              <Text className={styles.cardSectionTitle}>
                📖 认定依据
              </Text>
              <Text style={{ fontSize: '28rpx', color: '#666', lineHeight: '1.8' }}>
                {certificate.liabilityResult.ruleBasis}
              </Text>
            </View>
          )}
        </View>

        {certificate.status === 'verified' && (
          <View className={styles.verifySection}>
            <View className={styles.verifyIcon}>✅</View>
            <View className={styles.verifyInfo}>
              <Text className={styles.verifyTitle}>认定书已核验</Text>
              <Text className={styles.verifyCode}>核验码：{certificate.verifyCode}</Text>
            </View>
          </View>
        )}

        <View className={styles.actionGrid}>
          {actions.map(action => (
            <View
              key={action.id}
              className={styles.actionItem}
              onClick={() => handleAction(action.id)}
            >
              <View className={styles.actionIcon}>{action.icon}</View>
              <Text className={styles.actionText}>{action.text}</Text>
            </View>
          ))}
        </View>

        <View className={styles.safeBottom} />
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.btnSecondary} onClick={handleApplyReview}>
          申请复核
        </View>
        <View className={styles.btnPrimary} onClick={handleContactInsurance}>
          通知保险理赔
        </View>
      </View>
    </View>
  );
}
