import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { Vehicle } from './vehicle.entity';
import { Version } from '../versions/version.entity';
import { AuditModule } from '../audit/audit.module'; // 👈 NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, Version]),
    AuditModule, // 👈 SE AGREGA AQUÍ
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
