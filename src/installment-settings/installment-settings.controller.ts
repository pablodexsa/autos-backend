import { Controller, Get } from '@nestjs/common';
import { InstallmentSettingsService } from './installment-settings.service';

@Controller('installment-settings')
export class InstallmentSettingsController {
  constructor(private readonly service: InstallmentSettingsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
