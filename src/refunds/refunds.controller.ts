import {
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { RefundsService } from './refunds.service';
import { RefundStatus } from './refund.entity';
import { DeliverRefundDto } from './dto/deliver-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  findAll(@Query('q') q?: string, @Query('status') status?: RefundStatus) {
    return this.refundsService.findAll({ q, status });
  }

  @Patch(':id/deliver')
  deliver(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeliverRefundDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub ?? null;

    if (!userId) {
      throw new UnauthorizedException('No se pudo determinar el usuario logueado.');
    }

    return this.refundsService.deliver(id, dto, Number(userId));
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdfBuffer = await this.refundsService.getPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Comprobante_Devolucion_Reserva_${id}.pdf"`,
    );
    res.send(pdfBuffer);
  }
}
