import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ✅ Obtener todas las ventas
  @Get()
  @ApiOperation({ summary: 'Listar todas las ventas' })
  @ApiResponse({ status: 200, description: 'Lista de ventas obtenida correctamente' })
  async findAll() {
    try {
      return await this.salesService.findAll();
    } catch (error) {
      throw new HttpException(
        'Error al obtener las ventas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ Obtener una venta específica
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una venta por ID' })
  @ApiResponse({ status: 200, description: 'Venta encontrada correctamente' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.salesService.findOne(id);
    } catch {
      throw new HttpException(
        'La venta no existe o hubo un error al obtenerla',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ✅ Crear una nueva venta (corregido)
  @Post()
  @ApiOperation({ summary: 'Registrar una nueva venta' })
  @ApiResponse({ status: 201, description: 'Venta registrada correctamente' })
  async create(@Body() body: any) {
    try {
      console.log('📦 Datos recibidos en /sales:', body);

      const newSale = await this.salesService.create({
        clientId: Number(body.clientId),
        vehicleId: Number(body.vehicleId),
        sellerId: Number(body.sellerId),
        saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
        saleType: body.saleType || body.paymentType || 'contado',
        finalPrice: Number(body.finalPrice || body.salePrice || 0),
        downPayment: body.downPayment ? Number(body.downPayment) : null,
        installments: body.installments ? Number(body.installments) : null,
        installmentValue: body.installmentValue
          ? Number(body.installmentValue)
          : null,
      });

      console.log('✅ Venta registrada correctamente:', newSale?.id || '(sin ID)');
      return newSale;
    } catch (error) {
      console.error('❌ Error al registrar venta:', error);
      throw new HttpException(
        error.message || 'Error al registrar la venta',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ✅ Actualizar una venta
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una venta existente' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    try {
      return await this.salesService.update(id, body);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar la venta',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ✅ Eliminar una venta
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una venta' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.salesService.remove(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar la venta',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
