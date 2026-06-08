import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { navigateTo, showToast, showModal } from '@tarojs/taro';
import styles from './index.module.scss';
import { mockAccidents } from '@/data/mockAccident';

const accountMenus = [
  { id: 'verify', icon: '✅', title: '实名认证', badge: '未认证' },
  { id: 'vehicles', icon: '🚗', title: '我的车辆', desc: '已绑定 2 辆车' },
  { id: 'insurance', icon: '🛡️', title: '保险信息' },
  { id: 'driving', icon: '📄', title: '驾驶证信息' },
];

const serviceMenus = [
  { id: 'records', icon: '📋', title: '报案记录' },
  { id: 'certificates', icon: '📑', title: '我的认定书' },
  { id: 'feedback', icon: '💬', title: '意见反馈' },
  { id: 'about', icon: 'ℹ️', title: '关于我们' },
];

export default function Mine() {
  const [settings, setSettings] = useState({
    pushNotification: true,
    locationService: true,
  });

  const user = {
    name: '用户8888',
    phone: '138****8888',
    isVerified: false,
    stats: {
      reports: mockAccidents.length,
      certificates: mockAccidents.filter(a => a.liabilityResult).length,
      pending: mockAccidents.filter(a => a.status === 'processing').length,
    },
  };

  const handleMenuClick = (menu: { id: string; title: string }) => {
    if (menu.id === 'records') {
      navigateTo({ url: '/pages/report/index' });
    } else if (menu.id === 'certificates') {
      navigateTo({ url: '/pages/certificates/index' });
    } else {
      showToast({ title: `${menu.title}功能开发中`, icon: 'none' });
    }
  };

  const handleLogout = () => {
    showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          showToast({ title: '已退出登录', icon: 'success' });
        }
      },
    });
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View className={styles.userCard}>
          <View className={styles.avatar}>👤</View>
          <View className={styles.userInfo}>
            <Text className={styles.userName}>{user.name}</Text>
            <Text className={styles.userPhone}>{user.phone}</Text>
            {user.isVerified ? (
              <View className={styles.verifyBadge}>
                ✓ 已实名认证
              </View>
            ) : (
              <View className={styles.verifyBadge} style={{ background: 'rgba(255, 77, 79, 0.2)', color: '#FF4D4F' }}>
                ⚠ 未实名认证
              </View>
            )}
          </View>
        </View>

        <View className={styles.statsRow}>
          <View className={styles.statItem}>
            <Text className={styles.statNum}>{user.stats.reports}</Text>
            <Text className={styles.statLabel}>报案次数</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNum}>{user.stats.certificates}</Text>
            <Text className={styles.statLabel}>认定书</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNum}>{user.stats.pending}</Text>
            <Text className={styles.statLabel}>处理中</Text>
          </View>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>账号管理</Text>
          {accountMenus.map(menu => (
            <View
              key={menu.id}
              className={styles.menuItem}
              onClick={() => handleMenuClick(menu)}
            >
              <View className={styles.menuIcon}>{menu.icon}</View>
              <Text className={styles.menuText}>{menu.title}</Text>
              {menu.badge && (
                <View className={styles.menuBadge}>{menu.badge}</View>
              )}
              <Text className={styles.menuArrow}>›</Text>
            </View>
          ))}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>服务中心</Text>
          {serviceMenus.map(menu => (
            <View
              key={menu.id}
              className={styles.menuItem}
              onClick={() => handleMenuClick(menu)}
            >
              <View className={styles.menuIcon}>{menu.icon}</View>
              <Text className={styles.menuText}>{menu.title}</Text>
              <Text className={styles.menuArrow}>›</Text>
            </View>
          ))}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>设置</Text>
          <View className={styles.switchItem}>
            <View className={styles.switchInfo}>
              <View className={styles.menuIcon}>🔔</View>
              <Text className={styles.menuText}>推送通知</Text>
            </View>
            <View
              className={`${styles.switch} ${settings.pushNotification ? styles.active : ''}`}
              onClick={() => toggleSetting('pushNotification')}
            >
              <View className={styles.switchDot} />
            </View>
          </View>
          <View className={styles.switchItem}>
            <View className={styles.switchInfo}>
              <View className={styles.menuIcon}>📍</View>
              <Text className={styles.menuText}>定位服务</Text>
            </View>
            <View
              className={`${styles.switch} ${settings.locationService ? styles.active : ''}`}
              onClick={() => toggleSetting('locationService')}
            >
              <View className={styles.switchDot} />
            </View>
          </View>
        </View>

        <View className={styles.logoutBtn} onClick={handleLogout}>
          退出登录
        </View>

        <View className={styles.version}>
          交通事故快处 v1.0.0
        </View>

        <View className={styles.safeBottom} />
      </View>
    </View>
  );
}
