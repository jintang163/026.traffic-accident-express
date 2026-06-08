import { IsString, IsEnum, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
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
  ownerPhone: string;

  @IsString()
  insuranceCompany: string;
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
}

export class DetermineLiabilityDto {
  @IsOptional()
  @IsString()
  officer?: string;
}
