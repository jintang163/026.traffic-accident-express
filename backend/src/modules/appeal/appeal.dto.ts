import { IsString, IsArray, IsOptional, IsEnum, Length, IsUrl } from 'class-validator';

export class CreateAppealDto {
  @IsString()
  accidentId: string;

  @IsString()
  @Length(10, 500)
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disputedPoints?: string[];

  @IsOptional()
  @IsUrl()
  dashcamVideoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencePhotoUrls?: string[];

  @IsOptional()
  @IsString()
  additionalDescription?: string;

  @IsOptional()
  @IsEnum(['sms', 'face'])
  verifyMethod?: 'sms' | 'face';

  @IsString()
  verifyToken: string;
}

export class ReviewAppealDto {
  @IsEnum(['approved', 'rejected'])
  result: 'approved' | 'rejected';

  @IsString()
  reviewComment: string;

  @IsOptional()
  @IsString()
  reviewer?: string;

  @IsOptional()
  reviewResult?: {
    primaryParty?: string;
    secondaryParty?: string;
    primaryLiability?: number;
    secondaryLiability?: number;
    liabilityDescription?: string;
  };
}
