import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectoController } from './directo.controller';
import { DirectoService } from './directo.service';
import { DirectoLead } from './directo-lead.entity';
import { DirectoPortalProvider } from './providers/directo-portal.provider';

@Module({
  imports: [TypeOrmModule.forFeature([DirectoLead])],
  controllers: [DirectoController],
  providers: [
    DirectoService,
    DirectoPortalProvider,
    {
      provide: 'DIRECTO_PROVIDER',
      useExisting: DirectoPortalProvider,
    },
  ],
  exports: [DirectoService],
})
export class DirectoModule {} {}