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

  @IsString()
  ownerName: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  ownerPhone: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{12,18}$/, { message: '驾驶证号格式不正确' })
  driverLicenseNo?: string;

  @IsString()
  insuranceCompany: string;
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoInfoDto)
  scenePhotos: PhotoInfoDto[];

  @IsString()
  accidentType: string;

  @IsString()
  description: string;

  @IsString()
  weather: string;

  @IsString()
  roadCondition: string;

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

  @IsBoolean()
  integrityConfirmed: boolean;
}

export class DetermineLiabilityDto {
  @IsOptional()
  @IsString()
  officer?: string;
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
