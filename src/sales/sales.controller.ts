import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express'; // ✅ Importación corregida
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // 🔍 Vehículos elegibles
  @Get('eligible-vehicles')
  eligible(@Query('dni') dni?: string) {
    return this.salesService.eligibleVehiclesForDni(dni);
  }

  // 🧾 Crear venta
  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  // 📋 Listar ventas
  @Get()
  findAll() {
    return this.salesService.findAll();
  }

  // 🔎 Obtener una venta
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.findOne(id);
  }

  // 🖨️ Descargar comprobante PDF
  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const pdfBuffer = await this.salesService.getPdf(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="venta_${id}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (err) {
      console.error('❌ Error generando PDF:', err);
      res.status(500).json({ message: 'Error generando PDF de la venta' });
    }
  }
}
