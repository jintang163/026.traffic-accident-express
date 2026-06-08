import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccidentController } from './accident.controller';
import { AccidentService } from './accident.service';
import { AccidentEntity } from './accident.entity';
import { VehicleEntity } from './vehicle.entity';
import { PhotoEntity } from './photo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccidentEntity, VehicleEntity, PhotoEntity]),
  ],
  controllers: [AccidentController],
  providers: [AccidentService],
  exports: [AccidentService],
})
export class AccidentModule {}
