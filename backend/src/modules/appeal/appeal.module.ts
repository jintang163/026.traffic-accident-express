import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppealController } from './appeal.controller';
import { AppealService } from './appeal.service';
import { AppealEntity } from './appeal.entity';
import { AccidentModule } from '../accident/accident.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppealEntity]),
    AccidentModule,
    SecurityModule,
  ],
  controllers: [AppealController],
  providers: [AppealService],
  exports: [AppealService],
})
export class AppealModule {}
