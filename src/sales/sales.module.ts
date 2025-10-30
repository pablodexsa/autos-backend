import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './sale.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { Installment } from '../installments/installment.entity';
import { User } from '../users/user.entity'; // ✅ se agregó para poder inyectar UserRepository

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,          // Entidad principal
      Vehicle,       // Vehículo asociado
      Client,        // Cliente comprador
      Installment,   // Cuotas generadas
      User,          // ✅ Vendedor (usuario del sistema)
    ]),
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
