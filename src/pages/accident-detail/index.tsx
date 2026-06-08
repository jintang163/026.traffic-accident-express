import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { getCurrentPages, navigateTo, showToast, previewImage } from '@tarojs/taro';
import styles from './index.module.scss';
import { mockAccidents } from '@/data/mockAccident';
import { AccidentInfo } from '@/types/accident';
import { formatDateTime, getAccidentTypeText, getStatusText } from '@/utils/validator';

const mockTimeline = [
  { status: 'completed', time: '2024-01-15 14:30:00', title: '报案提交', desc: '您已成功提交事故报案' },
  { status: 'completed', time: '2024-01-15 14:32:00', title: '责任认定', desc: '系统已根据现场照片完成责任判定' },
  { status: 'completed', time: '2024-01-15 14:35:00', title: '认定书生成', desc: '电子认定书已生成，可查看下载' },
  { status: 'pending', time: '', title: '保险理赔', desc: '待您确认后自动推送至保险公司' },
];

export default function AccidentDetail() {
  const [accident, setAccident] = useState<AccidentInfo | null>(null);

  useEffect(() => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    const options = currentPage?.options || {};
    
    const id = options.id;
    if (id) {
      const found = mockAccidents.find(a => a.id === id);
      if (found) {
        setAccident(found);
      }
    }
    
    if (!accident && mockAccidents.length > 0) {
      setAccident(mockAccidents[0]);
    }
  }, []);

  const handlePreviewPhoto = (current: string) => {
    if (!accident) return;
    previewImage({
      current,
      urls: accident.photos.map(p => p.url),
    });
  };

  const handleGenerateCertificate = () => {
    if (!accident) return;
    navigateTo({
      url: `/pages/certificate-detail/index?accidentId=${accident.id}`,
    });
  };

  const handleReview = () => {
    showToast({ title: '申请复核功能开发中', icon: 'none' });
  };

  if (!accident) {
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

  return (
    <View className={styles.container}>
      <View className={styles.statusHeader}>
        <View className={`${styles.statusBadge} ${styles['status-' + accident.status]}`}>
          {getStatusText(accident.status)}
        </View>
        <Text className={styles.statusTitle}>
          {accident.status === 'completed' ? '事故处理已完成' : '事故处理中'}
        </Text>
        <Text className={styles.statusDesc}>
          {accident.status === 'completed' 
            ? '责任认定已完成，电子认定书已生成' 
            : '正在进行责任认定，请稍候...'
          }
        </Text>
        <Text className={styles.reportNo}>报案编号：{accident.reportNo}</Text>
      </View>

      <View className={styles.content}>
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>📍 事故信息</Text>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>事故类型</Text>
            <Text className={styles.infoValue}>{getAccidentTypeText(accident.accidentType)}</Text>
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
            <Text className={styles.infoLabel}>报案时间</Text>
            <Text className={styles.infoValue}>{formatDateTime(accident.createdAt)}</Text>
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>🚗 车辆信息</Text>
          {accident.vehicles.map((vehicle, index) => (
            <View key={index} className={styles.vehicleSection}>
              <View className={styles.vehicleHeader}>
                <View className={styles.vehicleTag}>{index === 0 ? 'A车（己方）' : 'B车（对方）'}</View>
              </View>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>车牌号码</Text>
                <Text className={styles.infoValue}>
                  <Text className={styles.plateNo}>{vehicle.plate?.plateNo || '-'}</Text>
                  {vehicle.plate?.plateColor && (
                    <Text className={styles.plateColor}>({vehicle.plate.plateColor})</Text>
                  )}
                </Text>
              </View>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>车主姓名</Text>
                <Text className={styles.infoValue}>{vehicle.ownerName || '-'}</Text>
              </View>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>联系电话</Text>
                <Text className={styles.infoValue}>{vehicle.ownerPhone || '-'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>🖼️ 现场照片</Text>
          <View className={styles.photoGrid}>
            {accident.photos.slice(0, 9).map((photo, index) => (
              <View
                key={index}
                className={styles.photoItem}
                onClick={() => handlePreviewPhoto(photo.url)}
              >
                <Image
                  className={styles.photoImage}
                  src={photo.url}
                  mode='aspectFill'
                />
              </View>
            ))}
          </View>
        </View>

        {accident.liabilityResult && (
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>⚖️ 责任认定</Text>
            <View className={styles.liabilityCard}>
              <Text className={styles.liabilityTitle}>
                📋 认定结果
              </Text>
              <Text className={styles.liabilityDesc}>
                {accident.liabilityResult.description}
              </Text>
              <View className={styles.liabilitySplit}>
                <View className={styles.liabilityItem}>
                  <Text className={styles.liabilityPercent}>{accident.liabilityResult.primaryRatio}%</Text>
                  <Text className={styles.liabilityLabel}>A车责任</Text>
                </View>
                <View className={styles.liabilityItem}>
                  <Text className={styles.liabilityPercent}>{accident.liabilityResult.secondaryRatio}%</Text>
                  <Text className={styles.liabilityLabel}>B车责任</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {accident.description && (
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>📝 事故描述</Text>
            <Text style={{ fontSize: '28rpx', color: '#333', lineHeight: '1.8' }}>
              {accident.description}
            </Text>
          </View>
        )}

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>📊 处理进度</Text>
          <View className={styles.timeline}>
            {mockTimeline.map((item, index) => (
              <View
                key={index}
                className={`${styles.timelineItem} ${styles[item.status]}`}
              >
                {item.time && <Text className={styles.timelineTime}>{item.time}</Text>}
                <Text className={styles.timelineTitle}>{item.title}</Text>
                <Text className={styles.timelineDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.safeBottom} />
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.btnSecondary} onClick={handleReview}>
          申请复核
        </View>
        <View className={styles.btnPrimary} onClick={handleGenerateCertificate}>
          查看认定书
        </View>
      </View>
    </View>
  );
}
