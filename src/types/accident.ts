export interface PlateInfo {
  plateNo: string;
  plateColor: string;
  vehicleType: string;
  confidence: number;
}

export interface PhotoInfo {
  id: string;
  url: string;
  thumbnailUrl: string;
  type: 'plate' | 'scene';
  watermarkInfo: WatermarkInfo;
  uploadTime: string;
}

export interface WatermarkInfo {
  timestamp: string;
  location: string;
  latitude: number;
  longitude: number;
}

export interface VehicleInfo {
  id: string;
  plateInfo: PlateInfo;
  platePhoto: PhotoInfo | null;
  ownerName: string;
  ownerPhone: string;
  insuranceCompany: string;
}

export interface AccidentInfo {
  id: string;
  reportNo: string;
  status: AccidentStatus;
  occurTime: string;
  location: string;
  latitude: number;
  longitude: number;
  vehicles: VehicleInfo[];
  scenePhotos: PhotoInfo[];
  accidentType: AccidentType;
  description: string;
  weather: string;
  roadCondition: string;
  liabilityResult?: LiabilityResult;
  createdAt: string;
  updatedAt: string;
}

export type AccidentStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export type AccidentType = 'rear_end' | 'side_swipe' | 'head_on' | 'reverse' | 'other';

export interface LiabilityResult {
  primaryParty: string;
  secondaryParty: string;
  primaryLiability: number;
  secondaryLiability: number;
  liabilityDescription: string;
  determinedAt: string;
  officer: string;
}

export interface OcrResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
  province: string;
  city: string;
  district: string;
}
