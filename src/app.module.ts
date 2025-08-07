import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { Vehicle } from './vehicles/vehicle.entity';
import { Purchase } from './purchases/purchase.entity';
import { Sale } from './sales/sale.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10), // ✅ valor por defecto
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [Vehicle, Purchase, Sale],
      synchronize: true,
      ssl: { rejectUnauthorized: false },
    }),
    VehiclesModule,
    PurchasesModule,
    SalesModule,
  ],
})
export class AppModule {}
