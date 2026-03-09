import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { DirectoService } from './directo.service';
import { ConsultDirectoDto } from './dto/consult-directo.dto';
import { CreateDirectoLeadDto } from './dto/create-directo-lead.dto';
import { UpdateDirectoLeadDto } from './dto/update-directo-lead.dto';
import { ListDirectoLeadsDto } from './dto/list-directo-leads.dto';

@Controller('directo')
export class DirectoController {
  constructor(private readonly directoService: DirectoService) {}

  @Post('consult')
  async consult(@Body() dto: ConsultDirectoDto, @Req() req: any) {
    return this.directoService.consult(dto, req.user?.id);
  }

  @Post('leads')
  async create(@Body() dto: CreateDirectoLeadDto, @Req() req: any) {
    return this.directoService.create(dto, req.user?.id);
  }

  @Get('leads')
  async findAll(@Query() query: ListDirectoLeadsDto) {
    return this.directoService.findAll(query);
  }

  @Get('leads/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.directoService.getOne(id);
  }

  @Patch('leads/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDirectoLeadDto,
  ) {
    return this.directoService.update(id, dto);
  }

  @Post('leads/:id/recheck')
  async recheck(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.directoService.recheck(id, req.user?.id);
  }

  @Delete('leads/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.directoService.remove(id);
  }
}