import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JudicialExecutionsService } from './judicial-executions.service';
import { CreateJudicialExecutionDto } from './dto/create-judicial-execution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('judicial-executions')
@UseGuards(JwtAuthGuard)
export class JudicialExecutionsController {
  constructor(private readonly judicialExecutionsService: JudicialExecutionsService) {}

  @Get('preview/:clientId')
  preview(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.judicialExecutionsService.preview(clientId);
  }

  @Post()
  create(@Body() dto: CreateJudicialExecutionDto, @Req() req: any) {
    const userId = req.user?.id ? Number(req.user.id) : undefined;
    return this.judicialExecutionsService.create(dto, userId);
  }

  @Get()
  findAll(@Query('q') q?: string) {
    return this.judicialExecutionsService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.judicialExecutionsService.findOne(id);
  }

@Patch(':id/close')
close(@Param('id', ParseIntPipe) id: number) {
  return this.judicialExecutionsService.close(id);
}

}