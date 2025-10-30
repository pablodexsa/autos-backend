import { Controller, Get, Post, Patch, Delete, Param, Body, Query, NotFoundException } from '@nestjs/common';
import { VersionsService } from './versions.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

@Controller('versions')
export class VersionsController {
  constructor(private readonly service: VersionsService) {}

  @Post()
  create(@Body() dto: CreateVersionDto) {
    return this.service.create(dto);
  }

  // ✅ Si llega ?modelId=..., filtramos versiones por modelo
  //    Si no, devolvemos todas
  @Get()
  async findAll(@Query('modelId') modelId?: string) {
    if (modelId) {
      const id = parseInt(modelId, 10);
      if (isNaN(id)) throw new NotFoundException('Invalid modelId');
      return this.service.findAll(id);
    }
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
