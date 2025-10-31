import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
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

  // ✅ CORS compatible local + Render
  const allowedOrigins = [
    'http://localhost:5173', // entorno local (Vite)
    'https://autos-frontend.onrender.com', // frontend desplegado en Render
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite peticiones sin "origin" (por ejemplo, desde herramientas locales o tests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS bloqueado para: ${origin}`);
        callback(new Error('CORS bloqueado para este origen: ' + origin));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ✅ Prefijo global de rutas
  app.setGlobalPrefix('api');

  // ✅ Archivos estáticos
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Validaciones y filtros
  // app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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

  // ✅ Puerto dinámico (Render o local)
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚗 Servidor corriendo en http://localhost:${port}`);
}

bootstrap();
