import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';


@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAudit(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('userId') userId?: number,
    @Query('action') action?: string,
    @Query('module') module?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.getPaginated({
      page: Number(page),
      limit: Math.min(Number(limit) || 50, 1000), // hard cap
      userId: userId ? Number(userId) : undefined,
      action,
      module,
      search,
      from,
      to,
    });
  }
}
