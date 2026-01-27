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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as express from 'express';

import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { QueryVehicleDto } from './dto/query-vehicle.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard) // ✅ auth para todo el controller
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

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
  // 📁 SUBIR DOCUMENTACIÓN VEHÍCULO
  // ============================
  @Post(':id/documentation')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'uploads', 'vehicle-docs'),
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const base = path.basename(file.originalname, ext);
          const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_');
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${safeBase}-${unique}${ext}`);
        },
      }),
    }),
  )
  async uploadDocumentation(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NotFoundException('No se adjuntó ningún archivo');
    }
    const relativePath = path.join('vehicle-docs', file.filename);
    const updated = await this.vehiclesService.attachDocumentation(
      id,
      relativePath,
    );
    return { ok: true, documentationPath: updated.documentationPath };
  }

  // ============================
  // 📁 DESCARGAR DOCUMENTACIÓN VEHÍCULO
  // ============================
  @Get(':id/documentation')
  async downloadDocumentation(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    const { absPath, filename } =
      await this.vehiclesService.getDocumentationPath(id);
    return res.download(absPath, filename);
  }

  // ============================
  // CRUD VEHÍCULOS
  // ============================

  // ✅ Nuevo vehículo → requiere permiso
  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('VEHICLE_CREATE')
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  // ✅ Listado (sin permiso por ahora)
  @Get()
  findAll(@Query() q: QueryVehicleDto) {
    q.page = q.page && Number(q.page) > 0 ? Number(q.page) : 1;
    q.limit = q.limit && Number(q.limit) > 0 ? Number(q.limit) : 10;
    return this.vehiclesService.findAll(q);
  }

  // ✅ Detalle (sin permiso por ahora)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOne(id);
  }

  // ✅ Editar vehículo → requiere permiso
  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('VEHICLE_EDIT')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  // ✅ Eliminar vehículo → requiere permiso
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('VEHICLE_DELETE')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.remove(id);
  }
}
