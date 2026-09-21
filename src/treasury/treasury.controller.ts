import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { multerConfig } from '../config/multer.config';
import { TreasuryService } from './treasury.service';
import { TreasuryCompany, TreasuryMovementType } from './treasury.enums';
import { CreateTreasuryAccountDto, CreateTreasuryCategoryDto, CreateTreasuryMovementDto, CreateTreasuryTransferDto, OpeningBalanceDto, UpdateTreasuryAccountDto, UpdateTreasuryCategoryDto, VoidTreasuryMovementDto } from './dto/treasury.dto';

@UseGuards(JwtAuthGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly service: TreasuryService) {}
  @Get('accounts') accounts(@Query('company') company?: TreasuryCompany, @Query('includeInactive') inactive?: string) { return this.service.findAccounts(company, inactive === 'true'); }
  @Post('accounts') createAccount(@Body() dto: CreateTreasuryAccountDto) { return this.service.createAccount(dto); }
  @Patch('accounts/:id') updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTreasuryAccountDto) { return this.service.updateAccount(id, dto); }
  @Delete('accounts/:id') deactivateAccount(@Param('id', ParseIntPipe) id: number) { return this.service.deactivateAccount(id); }
  @Get('categories') categories(@Query('type') type?: TreasuryMovementType, @Query('company') company?: TreasuryCompany, @Query('includeInactive') inactive?: string) { return this.service.findCategories(type, company, inactive === 'true'); }
  @Post('categories') createCategory(@Body() dto: CreateTreasuryCategoryDto) { return this.service.createCategory(dto); }
  @Patch('categories/:id') updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTreasuryCategoryDto) { return this.service.updateCategory(id, dto); }
  @Delete('categories/:id') deactivateCategory(@Param('id', ParseIntPipe) id: number) { return this.service.deactivateCategory(id); }
  @Get('movements') movements(@Query() query: any) { return this.service.findMovements(query); }
  @Post('movements') createMovement(@Body() dto: CreateTreasuryMovementDto, @Req() req: any) { return this.service.createMovement(dto, req.user.id); }
  @Post('movements/:id/attachment') @UseInterceptors(FileInterceptor('attachment', multerConfig)) attach(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: Express.Multer.File) { if (!file) throw new Error('Debe adjuntar un archivo'); return this.service.attachFile(id, `/uploads/${file.filename}`); }
  @Post('transfers') transfer(@Body() dto: CreateTreasuryTransferDto, @Req() req: any) { return this.service.transfer(dto, req.user.id); }
  @Post('opening-balance') opening(@Body() dto: OpeningBalanceDto, @Req() req: any) { return this.service.openingBalance(dto, req.user.id); }
  @Post('movements/:id/void') voidMovement(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidTreasuryMovementDto, @Req() req: any) { return this.service.voidMovement(id, req.user.id, dto.reason); }
  @Get('balances') balances(@Query('company') company?: TreasuryCompany) { return this.service.balances(company); }
  @Get('dashboard') dashboard(@Query('company') company?: TreasuryCompany, @Query('from') from?: string, @Query('to') to?: string) { return this.service.dashboard(company, from, to); }
}
