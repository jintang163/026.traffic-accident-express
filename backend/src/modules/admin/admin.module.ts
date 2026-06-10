import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AccidentModule } from '../accident/accident.module';
import { AppealModule } from '../appeal/appeal.module';
import { CertificateModule } from '../certificate/certificate.module';
import { AuditLogModule } from '../audit/audit-log.module';

@Module({
  imports: [
    AccidentModule,
    AppealModule,
    CertificateModule,
    AuditLogModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
