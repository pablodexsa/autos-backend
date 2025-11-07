// src/models/models.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { VersionsService } from '../versions/versions.service';
import { CreateVersionDto } from '../versions/dto/create-version.dto';

@Controller('models')
export class ModelsController {
  constructor(
    private readonly service: ModelsService,
    private readonly versionsService: VersionsService, // ✅ nuevo
  ) {}

  @Post()
  async create(@Body() dto: CreateModelDto) {
    if (!dto.brandId) throw new Error('brandId is required to create model');
    return this.service.create(dto.brandId, dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  // ✅ NUEVAS rutas para versiones relacionadas
  @Get(':modelId/versions')
  findVersions(@Param('modelId') modelId: string) {
    return this.versionsService.findByModel(+modelId);
  }

  @Post(':modelId/versions')
  createVersion(@Param('modelId') modelId: string, @Body() dto: CreateVersionDto) {
    return this.versionsService.create(+modelId, dto);
  }
}
