import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);

  // ✅ Crear rol "admin" si no existe
  let adminRole = await roleRepo.findOne({ where: { name: 'admin' } });
  if (!adminRole) {
    adminRole = roleRepo.create({
      name: 'admin',
      description: 'Administrador del sistema con acceso completo',
    });
    await roleRepo.save(adminRole);
    console.log('✅ Rol "admin" creado');
  }

  // ✅ Crear rol "viewer" si no existe
  let viewerRole = await roleRepo.findOne({ where: { name: 'viewer' } });
  if (!viewerRole) {
    viewerRole = roleRepo.create({
      name: 'viewer',
      description: 'Usuario con permisos de solo lectura',
    });
    await roleRepo.save(viewerRole);
    console.log('✅ Rol "viewer" creado');
  }

  // ✅ Crear usuario administrador
  const existingAdmin = await userRepo.findOne({
    where: { email: 'admin@degrazia.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Ninguno123!', 10);
    const adminUser = userRepo.create({
      name: 'Administrador',
      email: 'admin@degrazia.com',
      password: hashedPassword,
      isActive: true,
      role: adminRole,
    });
    await userRepo.save(adminUser);
    console.log('✅ Usuario administrador creado: admin@degrazia.com / Ninguno123!');
  } else {
    console.log('ℹ️ Usuario administrador ya existe.');
  }

  // ✅ Crear usuario viewer
  const existingViewer = await userRepo.findOne({
    where: { email: 'viewer@degrazia.com' },
  });

  if (!existingViewer) {
    const hashedPassword = await bcrypt.hash('Ninguno123!', 10);
    const viewerUser = userRepo.create({
      name: 'Usuario Viewer',
      email: 'viewer@degrazia.com',
      password: hashedPassword,
      isActive: true,
      role: viewerRole,
    });
    await userRepo.save(viewerUser);
    console.log('✅ Usuario viewer creado: viewer@degrazia.com / Ninguno123!');
  } else {
    console.log('ℹ️ Usuario viewer ya existe.');
  }
}
