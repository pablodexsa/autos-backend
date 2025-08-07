import { Controller, Get, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('document', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    })
  }))
  create(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    return this.purchasesService.create({
      vehicleId: Number(body.vehicleId),
      purchaseDate: body.purchaseDate, // nombre unificado
      price: Number(body.price),
      documentPath: file ? `uploads/${file.filename}` : null
    });
  }

  @Get()
  findAll() {
    return this.purchasesService.findAll();
  }
}
