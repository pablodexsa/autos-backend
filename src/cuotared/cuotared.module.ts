import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuotaRedLead } from './cuotared-lead.entity';
import { CuotaRedService } from './cuotared.service';
import { CuotaRedController } from './cuotared.controller';
import { CuotaRedPortalProvider } from './providers/cuotared-portal.provider';

@Module({
  imports: [TypeOrmModule.forFeature([CuotaRedLead])],
  controllers: [CuotaRedController],
  providers: [
    CuotaRedService,
    CuotaRedPortalProvider,
    {
      provide: 'CUOTARED_PROVIDER',
      useExisting: CuotaRedPortalProvider,
    },
  ],
})
export class CuotaRedModule {}