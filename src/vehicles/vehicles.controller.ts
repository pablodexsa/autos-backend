import { Controller, Get, Post, Body } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() body: any) {
    return this.vehiclesService.create({
      brand: body.brand,
      model: body.model,
      year: Number(body.year)
    });
  }

  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }
}
