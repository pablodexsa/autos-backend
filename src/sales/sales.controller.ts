import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // 🔍 Vehículos disponibles / reservados por DNI
  @UseGuards(JwtAuthGuard)
  @Get('eligible-vehicles')
  eligibleVehicles(@Query('dni') dni?: string) {
    return this.salesService.eligibleVehiclesForDni(dni);
  }

  // 🧾 Crear nueva venta (asociando vendedor desde el usuario logueado)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateSaleDto, @Req() req: Request) {
    const user: any = (req as any).user;

    const sellerId: number | undefined = user?.id;
    const sellerName: string | undefined = (() => {
      if (!user) return undefined;

      const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      if (full) return full;

      return user.name ?? user.email ?? undefined;
    })();

    return this.salesService.create(dto, sellerId, sellerName);
  }

  // 📋 Listado de ventas
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.salesService.findAll();
  }

  // 🔎 Detalle de una venta
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.findOne(id);
  }

  // 📄 PDF de una venta (sin guard para poder abrirlo directo en el navegador)
  @Get(':id/pdf')
  async getPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
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
      res
        .status(500)
        .json({ message: 'Error generando PDF de la venta' });
    }
  }
}
