// src/versions/versions.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { VersionsService } from './versions.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

@Controller('versions')
export class VersionsController {
  constructor(private readonly service: VersionsService) {}

  // ✅ Crear versión (debe incluir modelId en el body)
  @Post()
  async create(@Body() dto: CreateVersionDto) {
    if (!dto.modelId) {
      throw new Error('modelId is required to create version');
    }
    return this.service.create(dto.modelId, dto);
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
  update(@Param('id') id: string, @Body() dto: UpdateVersionDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
