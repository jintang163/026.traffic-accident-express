import { IsString, IsEnum, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean, Matches, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class PlateInfoDto {
  @IsString()
  plateNo: string;

  @IsString()
  plateColor: string;

  @IsString()
  vehicleType: string;

  @IsNumber()
  confidence: number;
}

export class PhotoInfoDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsEnum(['plate', 'scene'])
  type: 'plate' | 'scene';

  @IsOptional()
  watermarkInfo?: {
    timestamp: string;
    location: string;
    latitude: number;
    longitude: number;
  };
}

export class VehicleDto {
  @ValidateNested()
  @Type(() => PlateInfoDto)
  plateInfo: PlateInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoInfoDto)
  platePhoto?: PhotoInfoDto;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  driverLicenseNo?: string;

  @IsOptional()
  @IsString()
  insuranceCompany?: string;
}

export class CollisionPositionDto {
  @IsArray()
  @IsString({ each: true })
  vehicleA: string[];

  @IsArray()
  @IsString({ each: true })
  vehicleB: string[];
}

export class CreateAccidentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleDto)
  vehicles: VehicleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoInfoDto)
  scenePhotos?: PhotoInfoDto[];

  @IsString()
  accidentType: string;

  @IsOptional()
  @IsString()
  accidentTime?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  weather?: string;

  @IsOptional()
  @IsString()
  roadCondition?: string;

  @IsString()
  location: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CollisionPositionDto)
  collisionPositions?: CollisionPositionDto;

  @IsOptional()
  @IsBoolean()
  laneCrossingA?: boolean;

  @IsOptional()
  @IsBoolean()
  laneCrossingB?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDashcamVideo?: boolean;

  @IsOptional()
  @IsString()
  dashcamVideoUrl?: string;

  @IsBoolean()
  integrityConfirmed: boolean;
}

export class DetermineLiabilityDto {
  @IsOptional()
  @IsString()
  officer?: string;
}

export class ReviewLiabilityDto {
  @IsString()
  primaryParty: string;

  @IsNumber()
  primaryLiability: number;

  @IsNumber()
  secondaryLiability: number;

  @IsString()
  liabilityDescription: string;

  @IsOptional()
  @IsString()
  reviewComment?: string;

  @IsOptional()
  @IsString()
  reviewer?: string;
}

export class SaveDraftDto {
  @IsOptional()
  @IsString()
  draftId?: string;

  @IsOptional()
  data?: any;
}

export class DeleteDraftDto {
  @IsString()
  draftId: string;
}
