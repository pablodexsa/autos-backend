import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Model } from './model.entity';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';
import { Brand } from '../brands/brand.entity';
import { VersionsModule } from '../versions/versions.module'; // ✅ agregado

@Module({
  imports: [TypeOrmModule.forFeature([Model, Brand]), VersionsModule], // ✅ importamos VersionsModule
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
