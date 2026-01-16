import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './reservation.entity';
import { Guarantor } from './guarantor.entity';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';
import { ReservationsTasks } from './reservations.tasks';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module'; // 👈 NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Guarantor, Vehicle, Client, User]),
    SettingsModule, // para poder inyectar SettingsService en ReservationsService
    AuditModule,     // 👈 SE AGREGA AQUÍ
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsTasks],
  exports: [ReservationsService],
})
export class ReservationsModule {}
