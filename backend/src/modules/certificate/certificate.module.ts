import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { CertificateEntity } from './certificate.entity';
import { AccidentModule } from '../accident/accident.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { PdfGeneratorService } from './pdf-generator.service';
import { ElectronicSignatureService } from './electronic-signature.service';
import { QrCodeService } from './qrcode.service';
import { ThumbnailService } from './thumbnail.service';
import { EmailService } from './email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CertificateEntity]),
    AccidentModule,
    EvidenceModule,
  ],
  controllers: [CertificateController],
  providers: [
    CertificateService,
    PdfGeneratorService,
    ElectronicSignatureService,
    QrCodeService,
    ThumbnailService,
    EmailService,
  ],
  exports: [CertificateService],
})
export class CertificateModule {}
