import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  BadRequestException,
  NotFoundException,
  UseGuards,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import * as express from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoanClientsService } from './loan-clients.service';
import type { LoanClientDocType } from './loan-clients.service';
import { CreateLoanClientDto } from './dto/create-loan-client.dto';
import { UpdateLoanClientDto } from './dto/update-loan-client.dto';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Controller('loan-clients')
export class LoanClientsController {
  constructor(
    private readonly loanClientsService: LoanClientsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() data: CreateLoanClientDto) {
    return this.loanClientsService.create(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('q') q?: string,
    @Query('cuitCuil') cuitCuil?: string,
    @Query('firstName') firstName?: string,
    @Query('lastName') lastName?: string,
    @Query('aliasOrCbu') aliasOrCbu?: string,
  ) {
    return this.loanClientsService.findAll({
      q,
      cuitCuil,
      firstName,
      lastName,
      aliasOrCbu,
    });
  }

  @Get('search/by-cuit-cuil')
  @UseGuards(JwtAuthGuard)
  async searchByCuitCuil(@Query('cuitCuil') cuitCuil: string) {
    if (!cuitCuil || cuitCuil.trim() === '') {
      throw new BadRequestException('Debe ingresar un CUIT/CUIL para buscar.');
    }

    return this.loanClientsService.searchByCuitCuil(cuitCuil);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.loanClientsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateLoanClientDto,
  ) {
    return this.loanClientsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.loanClientsService.remove(id);
  }

  @Post(':id/documents/:docType')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('docType') docType: LoanClientDocType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NotFoundException('No se adjuntó ningún archivo.');
    }

    if (!['dni', 'business', 'service_bill', 'bank_account'].includes(docType)) {
      throw new BadRequestException('Tipo de documento inválido.');
    }

    const uploaded = await this.cloudinaryService.uploadLoanClientDoc({
      buffer: file.buffer,
      originalName: file.originalname,
      loanClientId: id,
      docType,
    });

    const updated = await this.loanClientsService.attachDocument(
      id,
      docType,
      uploaded.url,
    );

    return { ok: true, client: updated };
  }

  // Público para poder abrir el archivo en una pestaña nueva.
  // Solo redirige a la URL del adjunto ya subido a Cloudinary.
  @Get(':id/documents/:docType')
  async getDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('docType') docType: LoanClientDocType,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    if (!['dni', 'business', 'service_bill', 'bank_account'].includes(docType)) {
      throw new BadRequestException('Tipo de documento inválido.');
    }

    const url = await this.loanClientsService.getDocumentUrl(id, docType);
    res.redirect(url);
  }
}