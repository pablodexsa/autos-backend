// src/brands/brands.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

// ✅ Importamos ModelsService y DTO
import { ModelsService } from '../models/models.service';
import { CreateModelDto } from '../models/dto/create-model.dto';

@Controller('brands')
export class BrandsController {
  constructor(
    private readonly service: BrandsService,
    private readonly modelsService: ModelsService, // <-- agregado
  ) {}

  // === CRUD MARCAS ===
  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.service.create(dto);
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
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  // === MODELOS RELACIONADOS ===
  @Get(':brandId/models')
  findModels(@Param('brandId') brandId: string) {
    return this.modelsService.findByBrand(+brandId);
  }

  @Post(':brandId/models')
  createModel(@Param('brandId') brandId: string, @Body() dto: CreateModelDto) {
    return this.modelsService.create(+brandId, dto);
  }
}
