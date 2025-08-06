import { Controller, Get, Post, Body } from '@nestjs/common';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Post()
  create(@Body() body: any) {
    return this.purchasesService.create(body);
  }

  @Get()
  findAll() {
    return this.purchasesService.findAll();
  }
}
