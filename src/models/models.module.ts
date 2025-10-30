import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { Model } from './model.entity';
import { Brand } from '../brands/brand.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Model, Brand])],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
