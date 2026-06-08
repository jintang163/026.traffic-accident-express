import { useState, useMemo } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { navigateTo, showToast } from '@tarojs/taro';
import styles from './index.module.scss';
import { mockAccidents } from '@/data/mockAccident';
import { CertificateInfo } from '@/types/certificate';
import { formatDateTime } from '@/utils/validator';

const tabs = [
  { key: 'all', title: '全部' },
  { key: 'generated', title: '已生成' },
  { key: 'verified', title: '已核验' },
];

const mockCertificates: CertificateInfo[] = mockAccidents
  .filter(a => a.liabilityResult)
  .map((accident, index) => ({
    id: `cert_${index}`,
    certificateNo: `SD${Date.now().toString().slice(-8)}${String(index).padStart(4, '0')}`,
    accidentId: accident.id,
    accidentType: accident.accidentType,
    liabilityResult: accident.liabilityResult!,
    generatedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
    status: index % 3 === 0 ? 'verified' : 'generated',
    verifyCode: Math.random().toString(36).slice(-6).toUpperCase(),
    pdfUrl: '',
    sharedCount: Math.floor(Math.random() * 10),
    accidentInfo: accident,
  }));

export default function Certificates() {
  const [activeTab, setActiveTab] = useState('all');
  const [verifyNo, setVerifyNo] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const filteredCertificates = useMemo(() => {
    if (activeTab === 'all') return mockCertificates;
    return mockCertificates.filter(c => c.status === activeTab);
  }, [activeTab]);

  const handleVerify = () => {
    if (!verifyNo || !verifyCode) {
      showToast({ title: '请输入认定书编号和核验码', icon: 'none' });
      return;
    }
    navigateTo({
      url: `/pages/certificate-detail/index?certificateNo=${verifyNo}&verifyCode=${verifyCode}`,
    });
  };

  const handleViewDetail = (certificate: CertificateInfo) => {
    navigateTo({
      url: `/pages/certificate-detail/index?id=${certificate.id}`,
    });
  };

  const handleShare = (e: any, certificate: CertificateInfo) => {
    e.stopPropagation();
    showToast({ title: '分享功能开发中', icon: 'none' });
  };

  const handleDownload = (e: any, certificate: CertificateInfo) => {
    e.stopPropagation();
    showToast({ title: '下载功能开发中', icon: 'none' });
  };

  const getStatusText = (status: string) => {
    return status === 'verified' ? '已核验' : '已生成';
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>电子认定书</Text>
        <Text className={styles.headerSub}>道路交通事故电子认定书查询与核验</Text>
      </View>

      <View className={styles.tabs}>
        {tabs.map(tab => (
          <View
            key={tab.key}
            className={`${styles.tabItem} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.title}
          </View>
        ))}
      </View>

      <View className={styles.content}>
        <View className={styles.verifySection}>
          <Text className={styles.verifyTitle}>🔍 认定书核验</Text>
          <View className={styles.verifyInput}>
            <Input
              className={styles.input}
              placeholder='请输入认定书编号'
              value={verifyNo}
              onInput={(e) => setVerifyNo(e.detail.value)}
            />
          </View>
          <View className={styles.verifyInput}>
            <Input
              className={styles.input}
              placeholder='请输入核验码'
              value={verifyCode}
              onInput={(e) => setVerifyCode(e.detail.value)}
            />
            <View className={styles.verifyBtn} onClick={handleVerify}>
              核验
            </View>
          </View>
        </View>

        {filteredCertificates.length > 0 ? (
          <View className={styles.list}>
            {filteredCertificates.map(certificate => (
              <View
                key={certificate.id}
                className={styles.certificateCard}
                onClick={() => handleViewDetail(certificate)}
              >
                <View className={styles.cardHeader}>
                  <Text className={styles.cardTitle}>
                    道路交通事故认定书
                  </Text>
                  <View className={`${styles.statusBadge} ${styles['status-' + certificate.status]}`}>
                    {getStatusText(certificate.status)}
                  </View>
                </View>

                <View className={styles.cardInfo}>
                  <View className={styles.infoRow}>
                    <Text className={styles.infoLabel}>事故类型</Text>
                    <Text className={styles.infoValue}>
                      {certificate.accidentType ? {
                        rear_end: '追尾事故',
                        side_swipe: '变道刮擦',
                        head_on: '正面碰撞',
                        reverse: '倒车事故',
                        intersection: '路口事故',
                        other: '其他事故',
                      }[certificate.accidentType] : '未知'}
                    </Text>
                  </View>
                  <View className={styles.infoRow}>
                    <Text className={styles.infoLabel}>认定时间</Text>
                    <Text className={styles.infoValue}>
                      {formatDateTime(certificate.generatedAt)}
                    </Text>
                  </View>
                  <View className={styles.infoRow}>
                    <Text className={styles.infoLabel}>责任划分</Text>
                    <Text className={styles.infoValue}>
                      {certificate.liabilityResult?.description || '责任待认定'}
                    </Text>
                  </View>
                </View>

                <View className={styles.cardFooter}>
                  <Text className={styles.certificateNo}>
                    编号：{certificate.certificateNo}
                  </Text>
                  <View className={styles.actions}>
                    <View
                      className={`${styles.actionBtn} ${styles.btnOutline}`}
                      onClick={(e) => handleShare(e, certificate)}
                    >
                      分享
                    </View>
                    <View
                      className={`${styles.actionBtn} ${styles.btnPrimary}`}
                      onClick={(e) => handleDownload(e, certificate)}
                    >
                      下载
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📄</Text>
            <Text className={styles.emptyTitle}>暂无认定书</Text>
            <Text className={styles.emptyDesc}>完成事故报案后，系统将自动生成电子认定书</Text>
          </View>
        )}

        <View className={styles.safeBottom} />
      </View>
    </View>
  );
}
