import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type EvidenceStatus = 'pending' | 'valid' | 'expired' | 'revoked' | 'tampered';

export type EvidenceType = 'photo' | 'video' | 'document' | 'audio';

export type StorageProvider = 'tencent_cos' | 'aliyun_oss' | 'local';

export type ChainProvider = 'antchain' | 'notary' | 'mock';

@Entity('evidence')
export class EvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true })
  @Index()
  evidenceId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  accidentId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  photoId: string;

  @Column({
    type: 'enum',
    enum: ['photo', 'video', 'document', 'audio'],
    default: 'photo',
  })
  evidenceType: EvidenceType;

  @Column({ length: 500 })
  originalUrl: string;

  @Column({ length: 500, nullable: true })
  cdnUrl: string;

  @Column({ length: 255 })
  fileName: string;

  @Column({ type: 'bigint', default: 0 })
  fileSize: number;

  @Column({ length: 50, nullable: true })
  fileFormat: string;

  @Column({ length: 128, nullable: true })
  mimeType: string;

  @Column({ type: 'int', default: 0 })
  width: number;

  @Column({ type: 'int', default: 0 })
  height: number;

  @Column({ length: 64, nullable: true })
  @Index()
  md5Hash: string;

  @Column({ length: 128, nullable: true })
  sha1Hash: string;

  @Column({ length: 256, nullable: true })
  @Index()
  sha256Hash: string;

  @Column({ length: 256, unique: true })
  @Index()
  evidenceHash: string;

  @Column({ type: 'boolean', default: false })
  isHashed: boolean;

  @Column({ type: 'boolean', default: false })
  isOnChain: boolean;

  @Column({
    type: 'enum',
    enum: ['antchain', 'notary', 'mock'],
    nullable: true,
  })
  chainProvider: ChainProvider;

  @Column({ length: 256, nullable: true })
  chainTxId: string;

  @Column({ length: 256, nullable: true })
  chainBlockHeight: string;

  @Column({ length: 1024, nullable: true })
  chainProof: string;

  @Column({ type: 'timestamp', nullable: true })
  chainTime: Date;

  @Column({
    type: 'enum',
    enum: ['tencent_cos', 'aliyun_oss', 'local'],
    default: 'local',
  })
  storageProvider: StorageProvider;

  @Column({ length: 255, nullable: true })
  storageBucket: string;

  @Column({ length: 500, nullable: true })
  storageKey: string;

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
  watermarkInfo: {
    timestamp: string;
    location: string;
    latitude: number;
    longitude: number;
  };

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ['pending', 'valid', 'expired', 'revoked', 'tampered'],
    default: 'pending',
  })
  status: EvidenceStatus;

  @Column({ type: 'date' })
  expireDate: Date;

  @Column({ type: 'boolean', default: false })
  isExpired: boolean;

  @Column({ type: 'boolean', default: false })
  isTampered: boolean;

  @Column({ type: 'int', default: 0 })
  verifyCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastVerifyTime: Date;

  @Column({ length: 500, nullable: true })
  remark: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
