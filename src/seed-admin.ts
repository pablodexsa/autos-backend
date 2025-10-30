import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from './roles/role.entity';
import { User } from './users/user.entity';
import { InstallmentSetting } from './installments/installment-setting.entity';
import { InstallmentPayment } from './installment-payments/installment-payment.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roleRepo = app.get<Repository<Role>>(getRepositoryToken(Role));
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

  const adminRole =
    (await roleRepo.findOne({ where: { name: 'admin' } })) ||
    (await roleRepo.save(roleRepo.create({ name: 'admin' })));

  const existingAdmin = await userRepo.findOne({
    where: { email: 'admin@admin.com' },
  });

  if (!existingAdmin) {
    const adminUser = userRepo.create({
      name: 'Administrador',
      email: 'admin@admin.com',
      password: 'Ninguno123!',
      role: adminRole,
      isActive: true,
    });
    await userRepo.save(adminUser);
    console.log('? Usuario administrador creado');
  } else {
    console.log('?? El usuario administrador ya existe');
  }

  await app.close();
}

bootstrap();
