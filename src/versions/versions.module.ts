import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Version } from './version.entity';
import { VersionsService } from './versions.service';
import { VersionsController } from './versions.controller';
import { Model } from '../models/model.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Version, Model])],
  controllers: [VersionsController],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
