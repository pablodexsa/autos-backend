import { Controller, Get, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SalesService } from './sales.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('document', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    })
  }))
  create(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    return this.salesService.create({
      vehicleId: Number(body.vehicleId),
      saleDate: body.saleDate, // nombre unificado
      price: Number(body.price),
      documentPath: file ? `uploads/${file.filename}` : null
    });
  }

  @Get()
  findAll() {
    return this.salesService.findAll();
  }
}
