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

  // ✅ Configuración base mejorada
  app.use(json({ limit: '10mb' })); // <--- límite aumentado, evita que body llegue vacío
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.enableCors();
  app.setGlobalPrefix('api');

  // ✅ Archivos estáticos (para recibos, zips, etc.)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Validaciones globales
  // app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

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

  // ✅ Iniciar servidor
  await app.listen(3000);
  console.log(`🚗 Servidor corriendo en http://localhost:3000`);
}

bootstrap();
