import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { AccidentEntity } from './accident.entity';

export type PhotoType = 'plate' | 'scene';

export type PhotoSubType = 'plate_closeup' | 'scene_panorama' | 'collision_detail' | 'road_condition' | 'other';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export type ChainType = 'antchain' | 'notary' | 'mock';

@Entity('photos')
export class PhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AccidentEntity, (accident) => accident.scenePhotos, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'accidentId' })
  accident: AccidentEntity;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  accidentId: string;

  @Column({
    type: 'enum',
    enum: ['plate', 'scene'],
    default: 'scene',
  })
  type: PhotoType;

  @Column({
    type: 'enum',
    enum: ['plate_closeup', 'scene_panorama', 'collision_detail', 'road_condition', 'other'],
    default: 'other',
  })
  subType: PhotoSubType;

  @Column({ length: 500 })
  url: string;

  @Column({ length: 500, nullable: true })
  thumbnailUrl: string;

  @Column({ length: 500, nullable: true })
  cdnUrl: string;

  @Column({ type: 'int', default: 0 })
  size: number;

  @Column({ type: 'int', default: 0 })
  compressedSize: number;

  @Column({ type: 'int', default: 0 })
  width: number;

  @Column({ type: 'int', default: 0 })
  height: number;

  @Column({ length: 50, nullable: true })
  mimeType: string;

  @Column({ length: 50, nullable: true })
  fileFormat: string;

  @Column({ type: 'json', nullable: true })
  watermarkInfo: {
    timestamp: string;
    location: string;
    latitude: number;
    longitude: number;
  };

  @Column({ type: 'json', nullable: true })
  gpsInfo: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number;
    speed: number;
    direction: number;
    timestamp: string;
  };

  @Column({ type: 'json', nullable: true })
  deviceInfo: {
    deviceModel: string;
    osVersion: string;
    appVersion: string;
    platform: string;
    sdkVersion: string;
    deviceId: string;
  };

  @Column({ type: 'json', nullable: true })
  networkInfo: {
    networkType: string;
    signalStrength: number;
    uploadSpeed: number;
    retryCount: number;
  };

  @Column({ length: 64, nullable: true })
  @Index()
  md5Hash: string;

  @Column({ length: 128, nullable: true })
  sha1Hash: string;

  @Column({ length: 256, nullable: true })
  @Index()
  sha256Hash: string;

  @Column({ type: 'boolean', default: false })
  isHashed: boolean;

  @Column({ type: 'boolean', default: false })
  isOnChain: boolean;

  @Column({
    type: 'enum',
    enum: ['antchain', 'notary', 'mock'],
    nullable: true,
  })
  chainType: ChainType;

  @Column({ length: 256, nullable: true })
  chainTxId: string;

  @Column({ length: 256, nullable: true })
  chainBlockHeight: string;

  @Column({ length: 512, nullable: true })
  chainProof: string;

  @Column({ type: 'timestamp', nullable: true })
  chainTime: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'uploading', 'completed', 'failed'],
    default: 'pending',
  })
  uploadStatus: UploadStatus;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'int', default: 0 })
  currentChunk: number;

  @Column({ length: 256, nullable: true })
  uploadSessionId: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'date', nullable: true })
  expireDate: Date;

  @Column({ type: 'boolean', default: false })
  isExpired: boolean;

  @Column({ type: 'boolean', default: false })
  isTampered: boolean;

  @Column({ type: 'int', default: 1 })
  photoOrder: number;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  uploadTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedTime: Date;
}
