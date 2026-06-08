import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { navigateTo, switchTab, onPullDownRefresh, stopPullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import StatusCard from '@/components/StatusCard';
import { mockAccidents } from '@/data/mockAccident';
import { AccidentInfo } from '@/types/accident';

const quickMenus = [
  {
    id: 'certificate',
    icon: '📄',
    title: '认定书查询',
    desc: '查看电子认定书',
    url: '/pages/certificates/index',
  },
  {
    id: 'vehicles',
    icon: '🚗',
    title: '我的车辆',
    desc: '管理绑定车辆',
    url: '/pages/certificates/index',
  },
  {
    id: 'help',
    icon: '❓',
    title: '帮助中心',
    desc: '常见问题解答',
    url: '/pages/certificates/index',
  },
  {
    id: 'service',
    icon: '📞',
    title: '联系客服',
    desc: '在线人工客服',
    url: '/pages/certificates/index',
  },
];

const steps = [
  { num: '1', text: '拍照取证' },
  { num: '2', text: '信息采集' },
  { num: '3', text: '责任认定' },
  { num: '4', text: '生成文书' },
];

export default function Home() {
  const [accidents, setAccidents] = useState<AccidentInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    setTimeout(() => {
      setAccidents(mockAccidents.slice(0, 3));
      setLoading(false);
    }, 500);
  };

  const handlePullDownRefresh = () => {
    onPullDownRefresh(() => {
      loadData();
      stopPullDownRefresh();
    });
  };

  const handleStartReport = () => {
    navigateTo({ url: '/pages/camera/index' });
  };

  const handleQuickMenu = (item: typeof quickMenus[0]) => {
    if (item.url.startsWith('/pages/certificates')) {
      switchTab({ url: item.url });
    } else {
      navigateTo({ url: item.url });
    }
  };

  const handleViewAll = () => {
    switchTab({ url: '/pages/report/index' });
  };

  const handleAccidentClick = (accident: AccidentInfo) => {
    navigateTo({
      url: `/pages/accident-detail/index?id=${accident.id}`,
    });
  };

  const stats = {
    total: mockAccidents.length,
    completed: mockAccidents.filter(a => a.status === 'completed').length,
    pending: mockAccidents.filter(a => a.status === 'pending' || a.status === 'processing').length,
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.welcomeText}>您好，欢迎使用</Text>
        <Text className={styles.subText}>交通事故快速处理平台</Text>
        
        <View className={styles.reportSection}>
          <View className={styles.reportInfo}>
            <Text className={styles.reportTitle}>一键报案</Text>
            <Text className={styles.reportDesc}>
              快速拍照取证，智能识别车牌，自动生成电子认定书
            </Text>
          </View>
          <View
            className={styles.reportBtn}
            onClick={handleStartReport}
          >
            <Text className={styles.btnIcon}>🚨</Text>
            <Text className={styles.btnText}>快速报案</Text>
          </View>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.statsCard}>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats.total}</Text>
            <Text className={styles.statLabel}>报案总数</Text>
          </View>
          <View className={styles.statDivider} />
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats.completed}</Text>
            <Text className={styles.statLabel}>已完成</Text>
          </View>
          <View className={styles.statDivider} />
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats.pending}</Text>
            <Text className={styles.statLabel}>处理中</Text>
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.stepsCard}>
            <Text className={styles.stepsTitle}>报案处理流程</Text>
            <View className={styles.stepsContainer}>
              {steps.map((step, index) => (
                <View key={index} className={styles.stepItem}>
                  <View className={styles.stepIcon}>{step.num}</View>
                  <Text className={styles.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>快捷功能</Text>
          </View>
          <View className={styles.quickGrid}>
            {quickMenus.map((item) => (
              <View
                key={item.id}
                className={styles.quickItem}
                onClick={() => handleQuickMenu(item)}
              >
                <View className={styles.quickIcon}>{item.icon}</View>
                <View className={styles.quickInfo}>
                  <Text className={styles.quickTitle}>{item.title}</Text>
                  <Text className={styles.quickDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>最近报案</Text>
            <Text className={styles.sectionMore} onClick={handleViewAll}>
              查看全部 →
            </Text>
          </View>
          
          {accidents.length > 0 ? (
            <View className={styles.recordsList}>
              {accidents.map((accident) => (
                <StatusCard
                  key={accident.id}
                  accident={accident}
                  onClick={() => handleAccidentClick(accident)}
                />
              ))}
            </View>
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📋</Text>
              <Text className={styles.emptyText}>暂无报案记录</Text>
            </View>
          )}
        </View>

        <View className={styles.safeBottom} />
      </View>
    </View>
  );
}
