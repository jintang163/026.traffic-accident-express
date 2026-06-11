import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceEntity } from './evidence.entity';
import { PhotoEntity } from '../accident/photo.entity';
import { NotificationModule } from '../notification/notification.module';
import { ImageCompressionService } from './image-compression.service';
import { CloudStorageService } from './cloud-storage.service';
import { HashAndChainService } from './hash-and-chain.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvidenceEntity, PhotoEntity]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [EvidenceController],
  providers: [
    EvidenceService,
    ImageCompressionService,
    CloudStorageService,
    HashAndChainService,
  ],
  exports: [
    EvidenceService,
    ImageCompressionService,
    CloudStorageService,
    HashAndChainService,
  ],
})
export class EvidenceModule {}
