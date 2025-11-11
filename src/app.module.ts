import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ReservationsModule } from './reservations/reservations.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';



// 📦 Módulos internos
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { SalesModule } from './sales/sales.module';
import { ClientsModule } from './clients/clients.module';
import { BudgetsModule } from './budgets/budgets.module';
import { PurchasesModule } from './purchases/purchases.module';
import { InstallmentsModule } from './installments/installments.module';
import { InstallmentPaymentModule } from './installment-payments/installment-payment.module';
import { BrandsModule } from './brands/brands.module';
import { ModelsModule } from './models/models.module';
import { VersionsModule } from './versions/versions.module';
import { InstallmentSettingsModule } from './installment-settings/installment-settings.module';
import { BudgetReportsModule } from './budget-reports/budget-reports.module';
import { LoanRatesModule } from './loan-rates/loan-rates.module';
import { AuditModule } from './audit/audit.module';

// 📦 Entidades
import { User } from './users/user.entity';
import { Role } from './roles/role.entity';
import { Vehicle } from './vehicles/vehicle.entity';
import { Client } from './clients/entities/client.entity';
import { Sale } from './sales/sale.entity';
import { Budget } from './budgets/budget.entity';
import { Purchase } from './purchases/purchase.entity';
import { Installment } from './installments/installment.entity';
import { InstallmentPayment } from './installment-payments/installment-payment.entity';
import { InstallmentSetting } from './installments/installment-setting.entity';
import { Brand } from './brands/brand.entity';
import { Model } from './models/model.entity';
import { Version } from './versions/version.entity';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ReservationsModule,

    // ✅ Conexión PostgreSQL (Neon.tech)
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST || 'ep-gentle-poetry-acsrhj0f-pooler.sa-east-1.aws.neon.tech',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'neondb_owner',
  password: process.env.DB_PASS || 'npg_LNxq5nAcovp7',
  database: process.env.DB_NAME || 'neondb',
  ssl: { rejectUnauthorized: false }, // 🔥 requerido siempre con Neon
  synchronize: true,
  autoLoadEntities: true,
  entities: [
    User,
    Role,
    Vehicle,
    Client,
    Sale,
    Budget,
    Purchase,
    Installment,
    InstallmentPayment,
    InstallmentSetting,
    Brand,
    Model,
    Version,
  ],
}),


    // 📁 Archivos estáticos (uploads)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    // 🚀 Módulos de la aplicación
    RolesModule,
    UsersModule,
    AuthModule,
    VehiclesModule,
    SalesModule,
    ClientsModule,
    BudgetsModule,
    PurchasesModule,
    InstallmentsModule,
    InstallmentPaymentModule,
    InstallmentSettingsModule,
    BrandsModule,
    ModelsModule,
    VersionsModule,
    BudgetReportsModule,
    LoanRatesModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
},

{
  provide: APP_INTERCEPTOR,
  useClass: AuditInterceptor,
}

  ],
})
export class AppModule {}
