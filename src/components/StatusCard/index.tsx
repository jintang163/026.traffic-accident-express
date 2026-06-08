import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import dayjs from 'dayjs';
import type { AccidentInfo } from '@/types/accident';
import { getStatusText, getAccidentTypeText } from '@/utils/validator';
import styles from './index.module.scss';

interface StatusCardProps {
  accident: AccidentInfo;
  onClick?: () => void;
}

const StatusCard: React.FC<StatusCardProps> = ({ accident, onClick }) => {
  const statusClass = accident.status;
  const statusText = getStatusText(accident.status);
  const accidentTypeText = getAccidentTypeText(accident.accidentType);

  return (
    <View className={styles.card} onClick={onClick}>
      <View className={styles.cardHeader}>
        <View className={styles.leftInfo}>
          <Text className={styles.reportNo}>{accident.reportNo}</Text>
          <View className={classnames(styles.statusTag, statusClass)}>
            <Text className={styles.statusText}>{statusText}</Text>
          </View>
        </View>
        <View className={styles.arrowIcon}>›</View>
      </View>

      <View className={styles.cardBody}>
        <View className={styles.locationRow}>
          <Text className={styles.locationIcon}>📍</Text>
          <Text className={styles.locationText}>{accident.location}</Text>
        </View>
        
        <View className={styles.timeRow}>
          <Text className={styles.timeIcon}>🕐</Text>
          <Text className={styles.timeText}>
            {dayjs(accident.occurTime).format('YYYY-MM-DD HH:mm')}
          </Text>
        </View>

        <View className={styles.vehiclesRow}>
          {accident.vehicles.map((vehicle, index) => (
            <View key={vehicle.id} className={styles.vehicleItem}>
              <View className={styles.vehicleTag}>
                <Text className={styles.vehicleIndex}>{index + 1}</Text>
              </View>
              <Text className={styles.plateNo}>{vehicle.plateInfo.plateNo}</Text>
              {index < accident.vehicles.length - 1 && (
                <Text className={styles.vsText}>VS</Text>
              )}
            </View>
          ))}
        </View>

        <View className={styles.typeRow}>
          <Text className={styles.typeLabel}>事故类型：</Text>
          <Text className={styles.typeValue}>{accidentTypeText}</Text>
        </View>
      </View>

      {accident.liabilityResult && (
        <View className={styles.cardFooter}>
          <Text className={styles.liabilityLabel}>责任认定：</Text>
          <Text className={styles.liabilityText}>
            {accident.liabilityResult.liabilityDescription}
          </Text>
        </View>
      )}
    </View>
  );
};

export default StatusCard;
