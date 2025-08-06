import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() body: any) {
    return this.vehiclesService.create(body);
  }

  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.vehiclesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() body: any) {
    return this.vehiclesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.vehiclesService.remove(id);
  }
}
