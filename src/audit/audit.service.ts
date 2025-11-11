import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { User } from '../users/user.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // Registrar log
  async log(userId: number, action: string, module: string, details?: any, ip?: string) {
    const entry = this.auditRepo.create({ userId, action, module, details, ip });
    return this.auditRepo.save(entry);
  }

  // Listado con paginación y filtros
  async getPaginated(filters: any) {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      module,
      search,
      from,
      to,
    } = filters;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .leftJoinAndMapOne('a.user', User, 'u', 'u.id = a.userId')
      .orderBy('a.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (userId) qb.andWhere('a.userId = :userId', { userId });
    if (action) qb.andWhere('a.action = :action', { action });
    if (module) qb.andWhere('a.module ILIKE :module', { module: `%${module}%` });

    if (search) {
      qb.andWhere(
        `(a.module ILIKE :search 
          OR a.action ILIKE :search
          OR a.ip ILIKE :search
          OR u.name ILIKE :search
          OR u.email ILIKE :search)`,
        { search: `%${search}%` }
      );
    }

    if (from && to) {
      qb.andWhere('a.createdAt BETWEEN :from AND :to', {
        from: `${from} 00:00:00`,
        to: `${to} 23:59:59`,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }
}
