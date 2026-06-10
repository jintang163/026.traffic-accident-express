import { Module } from '@nestjs/common';
import { SecurityVerifyService } from './security-verify.service';
import { SecurityVerifyController } from './security-verify.controller';

@Module({
  providers: [SecurityVerifyService],
  controllers: [SecurityVerifyController],
  exports: [SecurityVerifyService],
})
export class SecurityModule {}
