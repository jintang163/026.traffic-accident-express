import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppealController } from './appeal.controller';
import { AppealService } from './appeal.service';
import { AppealEntity } from './appeal.entity';
import { AccidentModule } from '../accident/accident.module';
import { SecurityModule } from '../security/security.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppealEntity]),
    AccidentModule,
    SecurityModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [AppealController],
  providers: [AppealService],
  exports: [AppealService],
})
export class AppealModule {}
