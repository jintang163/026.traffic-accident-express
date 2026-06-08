import React, { useState } from 'react';
import { View, Text, Input, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import type { PlateInfo, PhotoInfo } from '@/types/accident';
import { getPlateColorText, validatePlateNo, getPlateNoErrorMessage } from '@/utils/validator';
import styles from './index.module.scss';

interface PlateResultProps {
  plateInfo: PlateInfo | null;
  platePhoto: PhotoInfo | null;
  vehicleIndex: number;
  onPlateChange: (plateInfo: PlateInfo) => void;
  onReCapture: () => void;
  onEdit: () => void;
}

const PlateResult: React.FC<PlateResultProps> = ({
  plateInfo,
  platePhoto,
  vehicleIndex,
  onPlateChange,
  onReCapture,
  onEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPlateNo, setEditPlateNo] = useState('');
  const [error, setError] = useState('');

  const handleEdit = () => {
    if (plateInfo) {
      setEditPlateNo(plateInfo.plateNo);
      setIsEditing(true);
      onEdit();
    }
  };

  const handleSave = () => {
    const errorMsg = getPlateNoErrorMessage(editPlateNo);
    if (errorMsg) {
      setError(errorMsg);
      Taro.showToast({ title: errorMsg, icon: 'none' });
      return;
    }
    
    if (plateInfo) {
      onPlateChange({
        ...plateInfo,
        plateNo: editPlateNo.toUpperCase()
      });
    }
    setIsEditing(false);
    setError('');
    Taro.showToast({ title: '已保存', icon: 'success' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return '#00B42A';
    if (confidence >= 0.7) return '#FF7D00';
    return '#F53F3F';
  };

  if (!plateInfo) {
    return (
      <View className={styles.emptyContainer}>
        <View className={styles.emptyIcon}>🚗</View>
        <Text className={styles.emptyText}>请拍摄{vehicleIndex + 1}号车辆车牌</Text>
      </View>
    );
  }

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.vehicleTag}>{vehicleIndex + 1}号车辆</Text>
        {plateInfo.confidence && (
          <View 
            className={styles.confidenceTag}
            style={{ color: getConfidenceColor(plateInfo.confidence) }}
          >
            置信度 {(plateInfo.confidence * 100).toFixed(0)}%
          </View>
        )}
      </View>

      {platePhoto && (
        <View className={styles.photoPreview}>
          <Image 
            src={platePhoto.thumbnailUrl || platePhoto.url} 
            mode="aspectFill"
            className={styles.photoImage}
          />
        </View>
      )}

      {isEditing ? (
        <View className={styles.editSection}>
          <Input
            className={classnames(styles.plateInput, error && styles.inputError)}
            value={editPlateNo}
            onInput={(e) => {
              setEditPlateNo(e.detail.value.toUpperCase());
              if (error) setError('');
            }}
            placeholder="请输入车牌号"
            maxlength={8}
            autoFocus
          />
          {error && <Text className={styles.errorText}>{error}</Text>}
          
          <View className={styles.editActions}>
            <Button className={styles.cancelBtn} onClick={handleCancel}>
              取消
            </Button>
            <Button className={styles.saveBtn} onClick={handleSave}>
              保存
            </Button>
          </View>
        </View>
      ) : (
        <View className={styles.resultSection}>
          <View className={styles.plateDisplay}>
            <Text className={styles.plateLabel}>车牌号码</Text>
            <View className={styles.plateNoBox}>
              <Text className={styles.plateNo}>{plateInfo.plateNo}</Text>
            </View>
          </View>

          <View className={styles.infoGrid}>
            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>号牌颜色</Text>
              <Text className={styles.infoValue}>
                {getPlateColorText(plateInfo.plateColor)}
              </Text>
            </View>
            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>车辆类型</Text>
              <Text className={styles.infoValue}>{plateInfo.vehicleType}</Text>
            </View>
          </View>

          <View className={styles.actions}>
            <Button className={styles.editBtn} onClick={handleEdit}>
              修改
            </Button>
            <Button className={styles.retakeBtn} onClick={onReCapture}>
              重拍
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default PlateResult;
