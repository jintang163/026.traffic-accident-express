import { IsString, IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsBoolean, IsObject, IsArray } from 'class-validator';
import { EvidenceStatus, EvidenceType, StorageProvider, ChainProvider } from './evidence.entity';

export class CreateEvidenceDto {
  @IsUUID()
  @IsOptional()
  accidentId?: string;

  @IsUUID()
  @IsOptional()
  photoId?: string;

  @IsEnum(['photo', 'video', 'document', 'audio'])
  @IsOptional()
  evidenceType?: EvidenceType;

  @IsString()
  originalUrl: string;

  @IsString()
  @IsOptional()
  cdnUrl?: string;

  @IsString()
  fileName: string;

  @IsInt()
  @Min(0)
  fileSize: number;

  @IsString()
  @IsOptional()
  fileFormat?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsInt()
  @IsOptional()
  width?: number;

  @IsInt()
  @IsOptional()
  height?: number;

  @IsObject()
  @IsOptional()
  gpsInfo?: any;

  @IsObject()
  @IsOptional()
  deviceInfo?: any;

  @IsObject()
  @IsOptional()
  watermarkInfo?: any;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsEnum(['tencent_cos', 'aliyun_oss', 'local'])
  @IsOptional()
  storageProvider?: StorageProvider;

  @IsString()
  @IsOptional()
  storageBucket?: string;

  @IsString()
  @IsOptional()
  storageKey?: string;
}

export class VerifyEvidenceDto {
  @IsString()
  evidenceId: string;
}

export class QueryEvidenceDto {
  @IsUUID()
  @IsOptional()
  accidentId?: string;

  @IsUUID()
  @IsOptional()
  photoId?: string;

  @IsEnum(['pending', 'valid', 'expired', 'revoked', 'tampered'])
  @IsOptional()
  status?: EvidenceStatus;

  @IsEnum(['photo', 'video', 'document', 'audio'])
  @IsOptional()
  evidenceType?: EvidenceType;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;

  @IsBoolean()
  @IsOptional()
  isExpired?: boolean;

  @IsBoolean()
  @IsOptional()
  isOnChain?: boolean;
}

export class UpdateEvidenceStatusDto {
  @IsEnum(['pending', 'valid', 'expired', 'revoked', 'tampered'])
  status: EvidenceStatus;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class ChunkUploadInitDto {
  @IsString()
  fileName: string;

  @IsInt()
  @Min(1)
  totalSize: number;

  @IsString()
  @IsOptional()
  accidentId?: string;

  @IsEnum(['plate_closeup', 'scene_panorama', 'collision_detail', 'road_condition', 'other'])
  @IsOptional()
  photoSubType?: string;

  @IsObject()
  @IsOptional()
  gpsInfo?: any;

  @IsObject()
  @IsOptional()
  deviceInfo?: any;
}

export class ChunkUploadDto {
  @IsString()
  sessionId: string;

  @IsInt()
  @Min(0)
  chunkIndex: number;

  @IsString()
  @IsOptional()
  md5Hash?: string;
}

export class CompleteChunkUploadDto {
  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  accidentId?: string;

  @IsObject()
  @IsOptional()
  gpsInfo?: any;

  @IsObject()
  @IsOptional()
  deviceInfo?: any;

  @IsObject()
  @IsOptional()
  watermarkInfo?: any;
}

export class NetworkSpeedTestResult {
  downloadSpeed: number;
  uploadSpeed: number;
  latency: number;
  networkType?: string;
  isWeakNetwork: boolean;
}
