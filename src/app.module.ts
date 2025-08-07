import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { Vehicle } from './vehicles/vehicle.entity';
import { Purchase } from './purchases/purchase.entity';
import { Sale } from './sales/sale.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres', // tu usuario
      password: 'tu_password', // tu password
      database: 'autos',
      entities: [Vehicle, Purchase, Sale],
      synchronize: true, // crea/actualiza tablas automáticamente
    }),
    VehiclesModule,
    PurchasesModule,
    SalesModule,
  ],
})
export class AppModule {}
