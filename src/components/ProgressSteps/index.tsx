import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

interface ProgressStepsProps {
  currentStep: number;
  totalSteps: number;
  steps: { title: string; icon?: string }[];
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ currentStep, totalSteps, steps }) => {
  return (
    <View className={styles.stepsContainer}>
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        
        return (
          <View key={index} className={styles.stepItem}>
            <View className={styles.stepLine}>
              {index > 0 && (
                <View 
                  className={classnames(
                    styles.line, 
                    (isActive || isCompleted) && styles.lineActive
                  )} 
                />
              )}
            </View>
            
            <View className={styles.stepContent}>
              <View 
                className={classnames(
                  styles.stepCircle,
                  isActive && styles.active,
                  isCompleted && styles.completed
                )}
              >
                {isCompleted ? (
                  <Text className={styles.checkIcon}>✓</Text>
                ) : (
                  <Text className={styles.stepNumber}>{stepNum}</Text>
                )}
              </View>
              <Text 
                className={classnames(
                  styles.stepTitle,
                  isActive && styles.titleActive,
                  isCompleted && styles.titleCompleted
                )}
              >
                {step.title}
              </Text>
            </View>
            
            <View className={styles.stepLine}>
              {index < totalSteps - 1 && (
                <View 
                  className={classnames(
                    styles.line, 
                    isCompleted && styles.lineActive
                  )} 
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default ProgressSteps;
