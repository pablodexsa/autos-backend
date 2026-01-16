import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { AuditModule } from '../audit/audit.module'; // 👈 NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    AuditModule, // 👈 SE AGREGA AQUÍ
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
