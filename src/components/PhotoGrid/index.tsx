import React from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import type { PhotoInfo } from '@/types/accident';
import styles from './index.module.scss';

interface PhotoGridProps {
  photos: PhotoInfo[];
  maxPhotos: number;
  onAdd: () => void;
  onRemove: (photoId: string) => void;
  onPreview: (photo: PhotoInfo) => void;
  type: 'plate' | 'scene';
}

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  maxPhotos,
  onAdd,
  onRemove,
  onPreview,
  type
}) => {
  const handlePreview = (photo: PhotoInfo) => {
    const urls = photos.map(p => p.url);
    const current = photo.url;
    Taro.previewImage({ urls, current });
    onPreview(photo);
  };

  const handleRemove = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？',
      success: (res) => {
        if (res.confirm) {
          onRemove(photoId);
        }
      }
    });
  };

  return (
    <View className={styles.gridContainer}>
      {photos.map((photo) => (
        <View key={photo.id} className={styles.photoItem}>
          <Image
            src={photo.thumbnailUrl || photo.url}
            mode="aspectFill"
            className={styles.photoImage}
            onClick={() => handlePreview(photo)}
          />
          <View 
            className={styles.removeBtn}
            onClick={(e) => handleRemove(photo.id, e)}
          >
            <Text className={styles.removeIcon}>×</Text>
          </View>
          {type === 'scene' && photo.watermarkInfo && (
            <View className={styles.watermarkBadge}>
              <Text className={styles.watermarkText}>已加水印</Text>
            </View>
          )}
        </View>
      ))}
      
      {photos.length < maxPhotos && (
        <View className={styles.addItem} onClick={onAdd}>
          <View className={styles.addIcon}>+</View>
          <Text className={styles.addText}>
            {type === 'plate' ? '拍摄车牌' : '拍摄现场'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default PhotoGrid;
