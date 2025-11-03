import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { seedAdmin } from './seed/seed-admin';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Configuración base
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ✅ CORS compatible con local + Render
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://autos-frontend.onrender.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ✅ Prefijo global de rutas
  app.setGlobalPrefix('api');

  // ✅ Archivos estáticos
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Filtro global de errores
  app.useGlobalFilters(new AllExceptionsFilter());

  // ✅ Swagger
  const config = new DocumentBuilder()
    .setTitle('De Grazia Automotores - API')
    .setDescription('Backend para gestión de vehículos, ventas y cuotas')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ✅ Crear usuario admin si no existe
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    await seedAdmin(dataSource);
  } catch (err) {
    console.error('⚠️ Error al crear usuario administrador:', err.message);
  }

  // ✅ Loguear errores no controlados
  process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('🔥 Unhandled Rejection:', reason);
  });

  // ✅ Puerto dinámico (Render o local)
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚗 Servidor corriendo en http://localhost:${port}`);
}

bootstrap();
