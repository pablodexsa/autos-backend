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

  // Base
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS robusto: permite localhost + tu frontend en Render + cualquier subdominio *.onrender.com
  const allowList = new Set<string>([
    'http://localhost:5173',
    'https://autos-frontend.onrender.com',
  ]);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman/cURL o SSR
      try {
        const url = new URL(origin);
        const isRender = url.hostname.endsWith('.onrender.com');
        if (allowList.has(origin) || isRender) return cb(null, true);
      } catch (_) {}
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204, // preflight OK en navegadores viejos
  });

  // Prefijo global
  app.setGlobalPrefix('api');

  // Archivos estáticos
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

  // Filtros
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('De Grazia Automotores - API')
    .setDescription('Backend para gestión de vehículos, ventas y cuotas')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Health endpoints (útiles en Render)
const adapter = app.getHttpAdapter();

// 👇 Usa express.Response explícitamente
adapter.get('/health', (req: any, res: any) => {
  res.status(200).send('ok');
});

adapter.get('/api/health', (req: any, res: any) => {
  res.status(200).send('ok');
});


  // Seed admin
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    await seedAdmin(dataSource);
  } catch (err: any) {
    console.error('⚠️ Error al crear usuario administrador:', err?.message);
  }

  // Manejo de errores global de proceso (para ver en logs de Render)
  process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('🔥 Unhandled Rejection:', reason);
  });

  // Puerto
  const port = process.env.PORT || 3000;
  await app.listen(port as number, '0.0.0.0');
  console.log(`🚗 Servidor corriendo en http://localhost:${port}`);
}

bootstrap();
