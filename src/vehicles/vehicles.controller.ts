import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Res,
  NotFoundException,
  Sse,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as express from 'express';

import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { QueryVehicleDto } from './dto/query-vehicle.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@UseGuards(JwtAuthGuard) // ✅ auth para todo el controller
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ============================
  // 🔄 STREAM (SSE) DE CAMBIOS
  // ============================
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.vehiclesService.getUpdatesStream().pipe(
      map((event) => ({ data: event } as MessageEvent)),
    );
  }

  // ============================
  // 📁 SUBIR DOCUMENTACIÓN VEHÍCULO (Cloudinary)
  // ============================
  @Post(':id/documentation')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB (ajustalo si querés)
    }),
  )
  async uploadDocumentation(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new NotFoundException('No se adjuntó ningún archivo');

    const uploaded = await this.cloudinaryService.uploadVehicleDoc({
      buffer: file.buffer,
      originalName: file.originalname,
      vehicleId: id,
    });

    const updated = await this.vehiclesService.attachDocumentation(
      req.user,
      id,
      uploaded.url, // ✅ guardamos URL
    );

    return { ok: true, documentationPath: updated.documentationPath };
  }

  // ============================
  // 📁 DESCARGAR DOCUMENTACIÓN VEHÍCULO
  // ============================
  @Get(':id/documentation')
  async downloadDocumentation(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: express.Response,
    @Req() req: any,
  ) {
    const url = await this.vehiclesService.getDocumentationUrlIfAny(req.user, id);
    if (url) {
      res.redirect(url);
      return;
    }

    // legacy: filesystem
    const { absPath, filename } =
      await this.vehiclesService.getDocumentationPath(req.user, id);

    res.download(absPath, filename);
  }

  // ============================
  // CRUD VEHÍCULOS
  // ============================

  // ✅ Crear (valida permisos por category dentro del service)
  @Post()
  create(@Body() dto: CreateVehicleDto, @Req() req: any) {
    return this.vehiclesService.create(req.user, dto);
  }

  // ✅ Listado (filtra por categorías permitidas dentro del service)
  @Get()
  findAll(@Query() q: QueryVehicleDto, @Req() req: any) {
    q.page = q.page && Number(q.page) > 0 ? Number(q.page) : 1;
    q.limit = q.limit && Number(q.limit) > 0 ? Number(q.limit) : 10;
    return this.vehiclesService.findAll(req.user, q);
  }

  // ✅ Detalle (valida que el user pueda ver esa categoría dentro del service)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.vehiclesService.findOne(req.user, id);
  }

  // ✅ Editar (valida permisos por categoría dentro del service)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
    @Req() req: any,
  ) {
    return this.vehiclesService.update(req.user, id, dto);
  }

  /**
   * ✅ "Eliminar" vehículo (soft delete)
   * Internamente desactiva (isActive=false) para no romper FKs.
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.vehiclesService.remove(req.user, id);
  }

  /**
   * ♻️ Restaurar vehículo desactivado (opcional)
   */
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.vehiclesService.restore(req.user, id);
  }
}