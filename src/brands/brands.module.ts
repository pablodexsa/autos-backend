import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from './brand.entity';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { ModelsModule } from '../models/models.module'; // ✅ agregado

@Module({
  imports: [TypeOrmModule.forFeature([Brand]), ModelsModule], // ✅ importamos ModelsModule
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
