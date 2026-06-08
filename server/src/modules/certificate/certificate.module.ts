import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { CertificateEntity } from './certificate.entity';
import { AccidentModule } from '../accident/accident.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CertificateEntity]),
    AccidentModule,
  ],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
