import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallmentSetting } from './installment-setting.entity';
import { InstallmentSettingsService } from './installment-settings.service';
import { InstallmentSettingsController } from './installment-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InstallmentSetting])],
  controllers: [InstallmentSettingsController],
  providers: [InstallmentSettingsService],
  exports: [InstallmentSettingsService],
})
export class InstallmentSettingsModule {}
