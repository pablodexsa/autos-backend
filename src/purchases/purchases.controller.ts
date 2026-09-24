import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard) // 👈 necesario para que Auditoría registre el usuario
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // 📋 Listar compras
  @Get()
  findAll() {
    return this.purchasesService.findAll();
  }

  // 🔍 Obtener compra por ID
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.findOne(id);
  }

  // 🧾 Crear nueva compra
  @Post()
  create(@Body() dto: CreatePurchaseDto, @Req() req: any) {
    return this.purchasesService.create(dto, req.user.id);
  }

  // ❌ Eliminar compra
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.remove(id);
  }
}
