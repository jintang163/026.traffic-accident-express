import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccidentController } from './accident.controller';
import { AccidentService } from './accident.service';
import { AccidentEntity } from './accident.entity';
import { VehicleEntity } from './vehicle.entity';
import { PhotoEntity } from './photo.entity';
import { LiabilityRuleEntity } from './liability-rule.entity';
import { LiabilityRuleEngine } from './liability-rule-engine';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccidentEntity, VehicleEntity, PhotoEntity, LiabilityRuleEntity]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [AccidentController],
  providers: [AccidentService, LiabilityRuleEngine],
  exports: [AccidentService],
})
export class AccidentModule {}
