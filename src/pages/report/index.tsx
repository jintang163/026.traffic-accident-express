import { useState, useMemo } from 'react';
import { View, Text, Input, Textarea, Image } from '@tarojs/components';
import { navigateTo, showToast, redirectTo } from '@tarojs/taro';
import styles from './index.module.scss';
import ProgressSteps from '@/components/ProgressSteps';
import PlateResult from '@/components/PlateResult';
import PhotoGrid from '@/components/PhotoGrid';
import { useAccidentStore } from '@/store/useAccidentStore';
import { submitAccidentReport, determineLiability } from '@/services/accident';
import { AccidentType, PhotoInfo, VehicleInfo } from '@/types/accident';
import { formatDateTime } from '@/utils/validator';
import { getCurrentLocation } from '@/utils/location';

const steps = [
  { key: 1, title: '车牌识别' },
  { key: 2, title: '现场拍照' },
  { key: 3, title: '信息填写' },
  { key: 4, title: '提交确认' },
];

const accidentTypes: { type: AccidentType; icon: string; text: string }[] = [
  { type: 'rear_end', icon: '🚗💥🚗', text: '追尾事故' },
  { type: 'side_swipe', icon: '↔️💥', text: '变道刮擦' },
  { type: 'head_on', icon: '🚗↔️🚗', text: '正面碰撞' },
  { type: 'reverse', icon: '↩️💥', text: '倒车事故' },
  { type: 'intersection', icon: '🚦💥', text: '路口事故' },
  { type: 'other', icon: '❓', text: '其他事故' },
];

const photoTips = [
  '全景照片：包含两车位置、车道线、交通标志',
  '碰撞点特写：清晰展示碰撞部位和损坏程度',
  '车牌照片：两车的完整车牌号码',
  '其他佐证：刹车痕迹、散落物等',
];

export default function Report() {
  const {
    currentStep,
    setCurrentStep,
    vehicles,
    setVehiclePlate,
    photos,
    addPhoto,
    removePhoto,
    accidentType,
    setAccidentType,
    occurTime,
    setOccurTime,
    location,
    setLocation,
    description,
    setDescription,
    driverName,
    setDriverName,
    driverPhone,
    setDriverPhone,
    resetStore,
  } = useAccidentStore();

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 1:
        return vehicles.every(v => v.plateNo && v.plateColor);
      case 2:
        return photos.length >= 3;
      case 3:
        return (
          accidentType &&
          occurTime &&
          location?.address &&
          driverName &&
          driverPhone
        );
      case 4:
        return agreed;
      default:
        return false;
    }
  }, [currentStep, vehicles, photos, accidentType, occurTime, location, driverName, driverPhone, agreed]);

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1 && !canGoNext) {
      showToast({ title: '请完善两车车牌信息', icon: 'none' });
      return;
    }
    if (currentStep === 2 && !canGoNext) {
      showToast({ title: '请至少拍摄3张现场照片', icon: 'none' });
      return;
    }
    if (currentStep === 3 && !canGoNext) {
      showToast({ title: '请完善事故信息', icon: 'none' });
      return;
    }
    if (currentStep === 4 && !canGoNext) {
      showToast({ title: '请先确认信息无误', icon: 'none' });
      return;
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const reportData = {
        vehicles,
        photos,
        accidentType,
        occurTime,
        location,
        description,
        driverName,
        driverPhone,
      };

      const result = await submitAccidentReport(reportData);
      
      if (result.success) {
        await determineLiability(result.data.id);
        
        showToast({ title: '报案提交成功', icon: 'success' });
        
        setTimeout(() => {
          resetStore();
          redirectTo({
            url: `/pages/accident-detail/index?id=${result.data.id}`,
          });
        }, 1500);
      }
    } catch (error: any) {
      showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetakePlate = (vehicleIndex: number) => {
    navigateTo({
      url: `/pages/camera/index?vehicleIndex=${vehicleIndex}`,
    });
  };

  const handleEditPlate = (vehicleIndex: number, field: keyof VehicleInfo, value: string) => {
    const vehicle = vehicles[vehicleIndex];
    setVehiclePlate(vehicleIndex, { ...vehicle, [field]: value });
  };

  const handleSelectTime = () => {
    const now = new Date();
    setOccurTime(now.toISOString());
  };

  const handleGetLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (error) {
      showToast({ title: '获取位置失败，请手动输入', icon: 'none' });
    }
  };

  const handleAddPhoto = (photo: PhotoInfo) => {
    addPhoto(photo);
  };

  const handleRemovePhoto = (index: number) => {
    removePhoto(index);
  };

  const handleTypeSelect = (type: AccidentType) => {
    setAccidentType(type);
  };

  const selectedTypeText = useMemo(() => {
    return accidentTypes.find(t => t.type === accidentType)?.text || '';
  }, [accidentType]);

  const renderStep1 = () => (
    <View className={styles.stepContent}>
      {vehicles.map((vehicle, index) => (
        <View key={index} className={styles.vehicleCard}>
          <View className={styles.vehicleHeader}>
            <Text className={styles.vehicleLabel}>{index === 0 ? 'A车（己方）' : 'B车（对方）'}</Text>
            <Text
              className={styles.retakeBtn}
              onClick={() => handleRetakePlate(index)}
            >
              重拍车牌
            </Text>
          </View>
          <PlateResult
            plateInfo={vehicle.plate}
            editable
            onEdit={(field, value) => handleEditPlate(index, 'plate', { ...vehicle.plate, [field]: value })}
            onRetake={() => handleRetakePlate(index)}
          />
          <View className={styles.formGroup} style={{ marginTop: '24rpx', padding: 0 }}>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>车主姓名</Text>
              <Input
                className={styles.formInput}
                placeholder='请输入车主姓名'
                placeholderClass={styles.formPlaceholder}
                value={vehicle.ownerName || ''}
                onInput={(e) => handleEditPlate(index, 'ownerName', e.detail.value)}
              />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>联系电话</Text>
              <Input
                className={styles.formInput}
                type='number'
                placeholder='请输入联系电话'
                placeholderClass={styles.formPlaceholder}
                value={vehicle.ownerPhone || ''}
                onInput={(e) => handleEditPlate(index, 'ownerPhone', e.detail.value)}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderStep2 = () => (
    <View className={styles.stepContent}>
      <View className={styles.photoTips}>
        <Text className={styles.photoTipsTitle}>📸 拍照要求</Text>
        <View className={styles.photoTipsList}>
          {photoTips.map((tip, i) => (
            <View key={i} className={styles.tipItem}>
              <Text className={styles.tipDot}>•</Text>
              <Text>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
      
      <View className={styles.stepSection}>
        <Text className={styles.sectionTitle}>
          <Text className={styles.titleIcon}>🖼️</Text>
          现场照片（{photos.length}/9）
        </Text>
        <PhotoGrid
          photos={photos}
          onAdd={handleAddPhoto}
          onRemove={handleRemovePhoto}
          maxCount={9}
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View className={styles.stepContent}>
      <View className={styles.formGroup}>
        <View className={styles.formItem} onClick={handleSelectTime}>
          <Text className={styles.formLabel}>事故时间</Text>
          <Text className={styles.formInput}>
            {occurTime ? formatDateTime(occurTime) : (
              <Text className={styles.formPlaceholder}>请选择事故时间</Text>
            )}
          </Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View className={styles.formItem} onClick={handleGetLocation}>
          <Text className={styles.formLabel}>事故地点</Text>
          <Text className={styles.formInput}>
            {location?.address ? (
              location.address
            ) : (
              <Text className={styles.formPlaceholder}>点击获取当前位置</Text>
            )}
          </Text>
          <Text className={styles.arrow}>›</Text>
        </View>
      </View>

      <View className={styles.accidentTypeSection}>
        <Text className={styles.sectionTitle}>
          <Text className={styles.titleIcon}>🚨</Text>
          事故类型
        </Text>
        <View className={styles.typeScroll}>
          <View className={styles.typeList}>
            {accidentTypes.map((item) => (
              <View
                key={item.type}
                className={`${styles.typeItem} ${accidentType === item.type ? styles.active : ''}`}
                onClick={() => handleTypeSelect(item.type)}
              >
                <Text className={styles.typeIcon}>{item.icon}</Text>
                <Text className={styles.typeText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className={styles.formGroup} style={{ marginTop: '32rpx' }}>
        <View className={styles.formItem}>
          <Text className={styles.formLabel}>驾驶人姓名</Text>
          <Input
            className={styles.formInput}
            placeholder='请输入驾驶人姓名'
            placeholderClass={styles.formPlaceholder}
            value={driverName}
            onInput={(e) => setDriverName(e.detail.value)}
          />
        </View>
        <View className={styles.formItem}>
          <Text className={styles.formLabel}>联系电话</Text>
          <Input
            className={styles.formInput}
            type='number'
            placeholder='请输入联系电话'
            placeholderClass={styles.formPlaceholder}
            value={driverPhone}
            onInput={(e) => setDriverPhone(e.detail.value)}
          />
        </View>
      </View>

      <View className={styles.textareaGroup}>
        <Text className={styles.textareaLabel}>事故经过描述</Text>
        <Textarea
          className={styles.textarea}
          placeholder='请简要描述事故发生的经过...'
          placeholderClass={styles.formPlaceholder}
          value={description}
          onInput={(e) => setDescription(e.detail.value)}
          maxlength={500}
        />
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View className={styles.stepContent}>
      <View className={styles.summarySection}>
        <View className={styles.summaryGroup}>
          <Text className={styles.summaryGroupTitle}>车辆信息</Text>
          {vehicles.map((vehicle, index) => (
            <View key={index}>
              <View className={styles.summaryRow}>
                <Text className={styles.summaryLabel}>{index === 0 ? 'A车' : 'B车'}车牌</Text>
                <Text className={`${styles.summaryValue} ${styles.plateValue}`}>
                  {vehicle.plate?.plateNo || '-'}{vehicle.plate?.plateColor ? `(${vehicle.plate.plateColor})` : ''}
                </Text>
              </View>
              <View className={styles.summaryRow}>
                <Text className={styles.summaryLabel}>车主</Text>
                <Text className={styles.summaryValue}>{vehicle.ownerName || '-'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className={styles.summaryGroup}>
          <Text className={styles.summaryGroupTitle}>事故信息</Text>
          <View className={styles.summaryRow}>
            <Text className={styles.summaryLabel}>事故类型</Text>
            <Text className={styles.summaryValue}>{selectedTypeText || '-'}</Text>
          </View>
          <View className={styles.summaryRow}>
            <Text className={styles.summaryLabel}>事故时间</Text>
            <Text className={styles.summaryValue}>{occurTime ? formatDateTime(occurTime) : '-'}</Text>
          </View>
          <View className={styles.summaryRow}>
            <Text className={styles.summaryLabel}>事故地点</Text>
            <Text className={styles.summaryValue}>{location?.address || '-'}</Text>
          </View>
          <View className={styles.summaryRow}>
            <Text className={styles.summaryLabel}>驾驶人</Text>
            <Text className={styles.summaryValue}>{driverName || '-'}</Text>
          </View>
        </View>

        <View className={styles.summaryGroup}>
          <Text className={styles.summaryGroupTitle}>现场照片</Text>
          <View className={styles.photoPreview}>
            {photos.slice(0, 6).map((photo, index) => (
              <Image
                key={index}
                className={styles.photoThumb}
                src={photo.url}
                mode='aspectFill'
              />
            ))}
            {photos.length > 6 && (
              <View className={styles.photoThumb} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f5f5f5',
                fontSize: '24rpx',
                color: '#999',
              }}>
                +{photos.length - 6}
              </View>
            )}
          </View>
        </View>

        {description && (
          <View className={styles.summaryGroup}>
            <Text className={styles.summaryGroupTitle}>事故描述</Text>
            <Text className={styles.summaryValue} style={{ textAlign: 'left', marginLeft: 0 }}>
              {description}
            </Text>
          </View>
        )}
      </View>

      <View className={styles.disclaimer}>
        <Text className={styles.disclaimerText}>
          提示：提交后系统将根据上传的照片和信息进行责任判定，如有异议可申请人工复核。请确保所填信息真实有效。
        </Text>
      </View>

      <View
        className={styles.checkboxRow}
        onClick={() => setAgreed(!agreed)}
      >
        <View className={`${styles.checkbox} ${agreed ? styles.checked : ''}`}>
          <Text className={styles.checkIcon}>✓</Text>
        </View>
        <Text className={styles.checkboxText}>
          我已核对以上信息，确认所填内容真实有效，并同意《交通事故快处服务协议》
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <View className={styles.container}>
      <View className={styles.progressWrapper}>
        <ProgressSteps
          steps={steps}
          currentStep={currentStep}
        />
      </View>

      <View className={styles.content}>
        {renderCurrentStep()}
      </View>

      <View className={styles.bottomBar}>
        <View
          className={styles.btnPrev}
          onClick={handlePrev}
          disabled={currentStep === 1}
        >
          {currentStep === 1 ? '取消' : '上一步'}
        </View>
        <View
          className={styles.btnNext}
          onClick={handleNext}
          disabled={!canGoNext || submitting}
        >
          {currentStep === 4 ? '提交报案' : '下一步'}
        </View>
      </View>

      {submitting && (
        <View className={styles.loadingOverlay}>
          <View className={styles.loadingSpinner} />
          <Text className={styles.loadingText}>正在提交报案...</Text>
        </View>
      )}
    </View>
  );
}
