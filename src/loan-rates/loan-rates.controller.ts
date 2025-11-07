import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { LoanRatesService } from './loan-rates.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoanType } from './loan-rate.entity';

@ApiTags('Loan Rates')
@Controller('loan-rates')
export class LoanRatesController {
  constructor(private readonly service: LoanRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las tasas' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':type')
  @ApiOperation({
    summary: 'Listar tasas por tipo (prendario, personal, financiacion)',
  })
  async findByType(@Param('type') type: string) {
    return this.service.findByType(type as LoanType); // ✅ casteo explícito
  }

  @Get(':type/:months')
  @ApiOperation({ summary: 'Obtener tasa por tipo y cantidad de meses' })
  async findRate(
    @Param('type') type: string,
    @Param('months', ParseIntPipe) months: number,
  ) {
    return this.service.findRate(type as LoanType, months);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva tasa' })
  async create(
    @Body() dto: { type: string; months: number; rate: number },
  ) {
    return this.service.create({
      type: dto.type as LoanType, // ✅ casteo
      months: Number(dto.months),
      rate: Number(dto.rate),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tasa existente' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar tasa' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
