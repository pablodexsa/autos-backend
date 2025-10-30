import { Controller, Get, Post, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';

@Controller('models')
export class ModelsController {
  constructor(private readonly service: ModelsService) {}

  // ✅ Crear un modelo nuevo
  @Post()
  create(@Body() dto: CreateModelDto) {
    return this.service.create(dto);
  }

  // ✅ Obtener todos los modelos o filtrados por marca
  @Get()
  async findAll(@Query('brandId') brandId?: number) {
    return this.service.findAll(brandId ? +brandId : undefined);
  }

  // ✅ Obtener un modelo específico por id
  @Get(':id')
  async findOne(@Param('id') id: number) {
    const model = await this.service.findOne(+id);
    if (!model) throw new NotFoundException('Model not found');
    return model;
  }
}
