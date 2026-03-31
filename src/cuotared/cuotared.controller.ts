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
} from '@nestjs/common';
import { CuotaRedService } from './cuotared.service';
import { ConsultCuotaRedDto } from './dto/consult-cuotared.dto';
import { UpdateCuotaRedDto } from './dto/update-cuotared.dto';
import { ListCuotaRedLeadsDto } from './dto/list-cuotared-leads.dto';

@Controller('cuotared')
export class CuotaRedController {
  constructor(private readonly cuotaRedService: CuotaRedService) {}

  @Post('consult')
  async consult(@Body() dto: ConsultCuotaRedDto) {
    return this.cuotaRedService.consult(dto);
  }

  @Get('leads')
  async findAll(@Query() query: ListCuotaRedLeadsDto) {
    return this.cuotaRedService.findAll(query);
  }

  @Get('leads/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cuotaRedService.getOne(id);
  }

  @Patch('leads/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCuotaRedDto,
  ) {
    return this.cuotaRedService.update(id, dto);
  }

  @Post('leads/:id/recheck')
  async recheck(@Param('id', ParseIntPipe) id: number) {
    return this.cuotaRedService.recheck(id);
  }

  @Delete('leads/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.cuotaRedService.remove(id);
  }
}