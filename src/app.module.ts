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
import { HealthController } from './health/health.controller';

// ✅ NUEVO
import { RefundsModule } from './refunds/refunds.module';

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
import { SettingsModule } from './settings/settings.module';
import { Setting } from './settings/setting.entity';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DirectoModule } from './directo/directo.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CuotaRedModule } from './cuotared/cuotared.module';
import { JudicialExecutionsModule } from './judicial-executions/judicial-executions.module';
import { LoanClientsModule } from './loan-clients/loan-clients.module';
import { LoansModule } from './loans/loans.module';
import { LoanInstallmentsModule } from './loan-installments/loan-installments.module';
import { LoanInstallmentPaymentsModule } from './loan-installment-payments/loan-installment-payments.module';
import { KairosLeadsModule } from './kairos-leads/kairos-leads.module';
import { KairosWhatsappModule } from './kairos-whatsapp/kairos-whatsapp.module';

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
import { LoanClient } from './loan-clients/loan-client.entity';
import { Loan } from './loans/loan.entity';
import { LoanInstallment } from './loan-installments/loan-installment.entity';
import { LoanInstallmentPayment } from './loan-installment-payments/loan-installment-payment.entity';
import { LoanFundMovement } from './loans/loan-fund-movement.entity';
import { InstallmentSetting } from './installments/installment-setting.entity';
import { Brand } from './brands/brand.entity';
import { Model } from './models/model.entity';
import { Version } from './versions/version.entity';
import { Permission } from './permissions/permission.entity';
import { RolePermission } from './permissions/role-permission.entity';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ReservationsModule,

    // ✅ Conexión única usando DATABASE_URL (DEV y PROD)
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      ssl: { rejectUnauthorized: false },
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
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
        LoanClient,
        Loan,
        LoanInstallment,
        LoanInstallmentPayment,
        LoanFundMovement,
        InstallmentSetting,
        Brand,
        Model,
        Version,
        Setting,

        // ✅ NUEVO
        Permission,
        RolePermission,
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
    SettingsModule,
    MailModule,
    ScheduleModule.forRoot(),
    NotificationsModule,

    // ✅ NUEVO: expone /refunds
    RefundsModule,
    DirectoModule,
    DashboardModule,
    CuotaRedModule,
    JudicialExecutionsModule,
    LoanClientsModule,
    LoansModule,
    LoanInstallmentsModule,
    LoanInstallmentPaymentsModule,
    KairosLeadsModule,
    KairosWhatsappModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
