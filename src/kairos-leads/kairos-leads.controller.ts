import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  KairosLeadSource,
  KairosLeadStatus,
} from './kairos-lead.entity';
import { KairosLeadsService } from './kairos-leads.service';
import { CreateKairosLeadDto } from './dto/create-kairos-lead.dto';
import { UpdateKairosLeadDto } from './dto/update-kairos-lead.dto';
import { CreatePublicKairosLeadDto } from './dto/create-public-kairos-lead.dto';

@Controller('kairos-leads')
export class KairosLeadsController {
  constructor(private readonly kairosLeadsService: KairosLeadsService) {}

  @Post()
  create(@Body() dto: CreateKairosLeadDto) {
    return this.kairosLeadsService.create(dto);
  }

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('status') status?: KairosLeadStatus,
    @Query('source') source?: KairosLeadSource,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kairosLeadsService.findAll({
      q,
      status,
      source,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('statuses')
  getStatuses() {
    return Object.values(KairosLeadStatus);
  }

  @Get('sources')
  getSources() {
    return Object.values(KairosLeadSource);
  }

@Post(':id/bcra-check')
checkBcra(@Param('id', ParseIntPipe) id: number) {
  return this.kairosLeadsService.checkBcra(id);
}

@Post('public')
createPublic(@Body() dto: CreatePublicKairosLeadDto) {
  return this.kairosLeadsService.createPublic(dto);
}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kairosLeadsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKairosLeadDto,
  ) {
    return this.kairosLeadsService.update(id, dto);
  }

  @Patch(':id/status/:status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status', new ParseEnumPipe(KairosLeadStatus))
    status: KairosLeadStatus,
  ) {
    return this.kairosLeadsService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.kairosLeadsService.remove(id);
  }
}