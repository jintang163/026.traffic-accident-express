import { useState, useEffect, useRef } from 'react';
import { View, Text, Camera, Image } from '@tarojs/components';
import {
  navigateBack,
  showToast,
  chooseMedia,
  createCameraContext,
  getCurrentPages,
  getLaunchOptionsSync,
} from '@tarojs/taro';
import styles from './index.module.scss';
import { useAccidentStore } from '@/store/useAccidentStore';
import { recognizePlate } from '@/services/ocr';
import { addWatermarkToImage } from '@/utils/watermark';
import { getCurrentLocation } from '@/utils/location';
import { PhotoInfo } from '@/types/accident';

const modes = [
  { key: 'plate', title: '车牌识别' },
  { key: 'scene', title: '现场拍照' },
];

export default function CameraPage() {
  const { setVehiclePlate, addPhoto, photos, currentStep, setCurrentStep } = useAccidentStore();
  
  const [mode, setMode] = useState<'plate' | 'scene'>('plate');
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeTime, setRecognizeTime] = useState(0);
  const [location, setLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    const options = currentPage?.options || {};
    
    if (options.vehicleIndex !== undefined) {
      setVehicleIndex(parseInt(options.vehicleIndex));
      setMode('plate');
    } else if (options.mode === 'scene') {
      setMode('scene');
    }
    
    initLocation();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const initLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (error) {
      console.warn('获取位置失败:', error);
    }
  };

  const handleBack = () => {
    navigateBack();
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) {
      cameraRef.current = createCameraContext('accidentCamera');
    }
    
    try {
      const result = await new Promise<any>((resolve, reject) => {
        cameraRef.current.takePhoto({
          quality: 'high',
          success: resolve,
          fail: reject,
        });
      });
      
      const tempPath = result.tempImagePath;
      
      const startTime = Date.now();
      setRecognizing(true);
      setRecognizeTime(0);
      
      timerRef.current = setInterval(() => {
        setRecognizeTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      if (mode === 'plate') {
        await handlePlateRecognition(tempPath);
      } else {
        await handleScenePhoto(tempPath);
      }
      
      const elapsed = Date.now() - startTime;
      if (elapsed > 15000) {
        console.warn(`[OCR] 识别耗时超过15秒: ${elapsed}ms`);
      }
      
    } catch (error: any) {
      console.error('拍照失败:', error);
      showToast({
        title: error.message || '拍照失败，请重试',
        icon: 'none',
      });
    } finally {
      setRecognizing(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handlePlateRecognition = async (imagePath: string) => {
    try {
      const watermarkedImage = await addWatermarkToImage(imagePath, {
        time: new Date().toISOString(),
        location: location?.address || '未知位置',
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      
      setPreviewImage(watermarkedImage);
      
      const result = await recognizePlate(watermarkedImage);
      
      if (result.success && result.data) {
        const plateInfo = result.data;
        
        setVehiclePlate(vehicleIndex, {
          plateNo: plateInfo.plateNo,
          plateColor: plateInfo.plateColor,
          confidence: plateInfo.confidence,
        });
        
        showToast({
          title: `识别成功: ${plateInfo.plateNo}`,
          icon: 'success',
        });
        
        setTimeout(() => {
          if (currentStep === 1) {
            setCurrentStep(1);
          }
          navigateBack();
        }, 1500);
      } else {
        showToast({
          title: '未能识别车牌，请调整角度重拍',
          icon: 'none',
        });
        setPreviewImage('');
      }
    } catch (error: any) {
      console.error('车牌识别失败:', error);
      showToast({
        title: '识别失败，请重试',
        icon: 'none',
      });
      setPreviewImage('');
    }
  };

  const handleScenePhoto = async (imagePath: string) => {
    try {
      const watermarkedImage = await addWatermarkToImage(imagePath, {
        time: new Date().toISOString(),
        location: location?.address || '未知位置',
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      
      setPreviewImage(watermarkedImage);
      
      const photoInfo: PhotoInfo = {
        id: `photo_${Date.now()}`,
        url: watermarkedImage,
        type: 'scene',
        thumbnail: watermarkedImage,
        watermark: {
          time: new Date().toISOString(),
          location: location?.address || '未知位置',
          latitude: location?.latitude,
          longitude: location?.longitude,
        },
        uploadStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      
      showToast({
        title: '拍照成功',
        icon: 'success',
      });
      
      setTimeout(() => {
        addPhoto(photoInfo);
        if (currentStep === 1) {
          setCurrentStep(2);
        }
        navigateBack();
      }, 1000);
      
    } catch (error: any) {
      console.error('现场拍照失败:', error);
      showToast({
        title: '拍照失败，请重试',
        icon: 'none',
      });
      setPreviewImage('');
    }
  };

  const handleChooseFromAlbum = async () => {
    try {
      const result = await chooseMedia({
        count: mode === 'plate' ? 1 : 9,
        mediaType: ['image'],
        sourceType: ['album'],
      });
      
      if (result.tempFiles && result.tempFiles.length > 0) {
        const file = result.tempFiles[0];
        
        if (mode === 'plate') {
          await handlePlateRecognition(file.tempFilePath);
        } else {
          await handleScenePhoto(file.tempFilePath);
        }
      }
    } catch (error: any) {
      console.error('选择相册失败:', error);
    }
  };

  const handleSwitchCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.switchCamera({
        success: () => {
          console.log('切换摄像头成功');
        },
        fail: (error: any) => {
          console.error('切换摄像头失败:', error);
        },
      });
    }
  };

  const handleRetake = () => {
    setPreviewImage('');
  };

  const handleConfirmPhoto = () => {
    setPreviewImage('');
    navigateBack();
  };

  const handleModeSwitch = (newMode: 'plate' | 'scene') => {
    setMode(newMode);
    setPreviewImage('');
  };

  const guideText = mode === 'plate' 
    ? '请将车牌对准框内，保持光线充足'
    : '请拍摄事故全景、碰撞点、车牌等关键位置';

  return (
    <View className={styles.container}>
      <View className={styles.cameraWrapper}>
        <Camera
          id='accidentCamera'
          className={styles.camera}
          devicePosition='back'
          flash={flashOn ? 'on' : 'off'}
          resolution='high'
        />
        
        <View className={styles.overlay}>
          <View className={styles.modeTabs}>
            {modes.map(item => (
              <View
                key={item.key}
                className={`${styles.modeTab} ${mode === item.key ? styles.active : ''}`}
                onClick={() => handleModeSwitch(item.key as any)}
              >
                {item.title}
              </View>
            ))}
          </View>
          
          {mode === 'plate' && (
            <>
              <View className={styles.guideCorners}>
                <View className={`${styles.corner} ${styles.topLeft}`} />
                <View className={`${styles.corner} ${styles.topRight}`} />
                <View className={`${styles.corner} ${styles.bottomLeft}`} />
                <View className={`${styles.corner} ${styles.bottomRight}`} />
              </View>
              <Text className={styles.guideText}>{guideText}</Text>
            </>
          )}
          
          {mode === 'scene' && (
            <Text className={styles.guideText}>{guideText}</Text>
          )}
          
          {recognizing && recognizeTime > 0 && (
            <View className={styles.timer}>
              识别中... {recognizeTime}s
            </View>
          )}
          
          {mode === 'scene' && photos.length > 0 && (
            <View className={styles.watermarkPreview}>
              <Text className={styles.watermarkText}>
                📍 {location?.address || '定位中...'}
              </Text>
              <Text className={styles.watermarkText}>
                🕐 {new Date().toLocaleString('zh-CN')}
              </Text>
            </View>
          )}
        </View>
        
        <View className={styles.topBar}>
          <View className={styles.backBtn} onClick={handleBack}>
            ✕
          </View>
          <View className={styles.vehicleIndicator}>
            {mode === 'plate' 
              ? `${vehicleIndex === 0 ? 'A车' : 'B车'}车牌`
              : `现场照片 ${photos.length}/9`
            }
          </View>
          <View
            className={`${styles.flashBtn} ${flashOn ? styles.active : ''}`}
            onClick={toggleFlash}
          >
            {flashOn ? '⚡' : '💡'}
          </View>
        </View>
        
        <View className={styles.bottomBar}>
          <View className={styles.albumBtn} onClick={handleChooseFromAlbum}>
            🖼️
            {photos.length > 0 && (
              <View className={styles.albumCount}>{photos.length}</View>
            )}
          </View>
          <View className={styles.shutterBtn} onClick={handleTakePhoto} />
          <View className={styles.switchBtn} onClick={handleSwitchCamera}>
            🔄
          </View>
        </View>
      </View>
      
      {previewImage && (
        <View className={styles.previewOverlay}>
          <Image
            className={styles.previewImage}
            src={previewImage}
            mode='aspectFit'
          />
          <View className={styles.previewActions}>
            <View className={styles.btnRetake} onClick={handleRetake}>
              重拍
            </View>
            <View className={styles.btnConfirm} onClick={handleConfirmPhoto}>
              确认使用
            </View>
          </View>
        </View>
      )}
      
      {recognizing && (
        <View className={styles.loadingOverlay}>
          <View className={styles.spinner} />
          <Text className={styles.loadingText}>
            {mode === 'plate' ? '正在识别车牌...' : '正在处理图片...'}
          </Text>
          <Text className={styles.loadingSubText}>
            {recognizeTime > 0 ? `已用时 ${recognizeTime} 秒，最长15秒` : '请稍候...'}
          </Text>
        </View>
      )}
    </View>
  );
}
