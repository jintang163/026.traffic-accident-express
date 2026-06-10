import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AccidentModule } from './modules/accident/accident.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { AppealModule } from './modules/appeal/appeal.module';
import { SecurityModule } from './modules/security/security.module';
import { AuditLogModule } from './modules/audit/audit-log.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_DATABASE || './data/traffic_accident.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    ConfigModule,
    AuthModule,
    UserModule,
    AccidentModule,
    OcrModule,
    CertificateModule,
    EvidenceModule,
    AppealModule,
    SecurityModule,
    AuditLogModule,
    AdminModule,
  ],
})
export class AppModule {}
