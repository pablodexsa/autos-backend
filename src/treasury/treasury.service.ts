import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TreasuryAccount } from './treasury-account.entity';
import { TreasuryAllocation } from './treasury-allocation.entity';
import { TreasuryCategory } from './treasury-category.entity';
import { TreasuryMovement } from './treasury-movement.entity';
import { TreasuryCompany, TreasuryMovementStatus, TreasuryMovementType, TreasuryPaymentMethod } from './treasury.enums';
import { CreateTreasuryAccountDto, CreateTreasuryCategoryDto, CreateTreasuryMovementDto, CreateTreasuryTransferDto, OpeningBalanceDto, UpdateTreasuryAccountDto, UpdateTreasuryCategoryDto } from './dto/treasury.dto';

@Injectable()
export class TreasuryService {
  constructor(
    @InjectRepository(TreasuryAccount) private accounts: Repository<TreasuryAccount>,
    @InjectRepository(TreasuryCategory) private categories: Repository<TreasuryCategory>,
    @InjectRepository(TreasuryMovement) private movements: Repository<TreasuryMovement>,
    @InjectRepository(TreasuryAllocation) private allocations: Repository<TreasuryAllocation>,
    private dataSource: DataSource,
  ) {}


  async createAutomaticMovement(
    manager: EntityManager,
    params: {
      company: TreasuryCompany;
      type: TreasuryMovementType.INCOME | TreasuryMovementType.EXPENSE;
      movementDate: string;
      amount: number;
      accountId: number;
      paymentMethod: TreasuryPaymentMethod;
      description: string;
      sourceType: string;
      sourceId: number;
      createdBy: number;
      reference?: string | null;
      counterparty?: string | null;
      loanId?: number | null;
      installmentId?: number | null;
      paymentId?: number | null;
      saleId?: number | null;
      clientId?: number | null;
    },
  ) {
    const existing = await manager.findOne(TreasuryMovement, {
      where: { sourceType: params.sourceType, sourceId: params.sourceId },
    });
    if (existing) return existing;

    if (!params.accountId || !Number.isInteger(Number(params.accountId))) {
      throw new BadRequestException('Debe seleccionar una cuenta de Tesorería');
    }

    const account = await manager.findOne(TreasuryAccount, { where: { id: Number(params.accountId) } });
    if (!account || !account.isActive) throw new BadRequestException('La cuenta de Tesorería seleccionada no existe o está inactiva');
    if (account.company !== params.company) throw new BadRequestException('La cuenta de Tesorería no pertenece a la empresa de la operación');

    const amount = Math.abs(Number(params.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El importe de Tesorería debe ser mayor a cero');

    const movement = await manager.save(manager.create(TreasuryMovement, {
      company: params.company, type: params.type, movementDate: params.movementDate,
      totalAmount: amount, categoryId: null, counterparty: params.counterparty ?? null,
      description: params.description, reference: params.reference ?? null,
      sourceType: params.sourceType, sourceId: params.sourceId,
      loanId: params.loanId ?? null, installmentId: params.installmentId ?? null,
      paymentId: params.paymentId ?? null, saleId: params.saleId ?? null,
      clientId: params.clientId ?? null, attachmentPath: null, createdBy: params.createdBy,
    }));

    const sign = params.type === TreasuryMovementType.EXPENSE ? -1 : 1;
    await manager.save(manager.create(TreasuryAllocation, {
      movementId: movement.id, accountId: account.id, amount: sign * amount,
      paymentMethod: params.paymentMethod, reference: params.reference ?? null,
    }));
    return movement;
  }


  async createAutomaticMovementWithAllocations(
    manager: EntityManager,
    params: {
      company: TreasuryCompany;
      type: TreasuryMovementType.INCOME | TreasuryMovementType.EXPENSE;
      movementDate: string;
      allocations: Array<{
        accountId: number;
        amount: number;
        paymentMethod: TreasuryPaymentMethod;
        reference?: string | null;
      }>;
      description: string;
      sourceType: string;
      sourceId: number;
      createdBy: number;
      reference?: string | null;
      counterparty?: string | null;
      loanId?: number | null;
      installmentId?: number | null;
      paymentId?: number | null;
      saleId?: number | null;
      clientId?: number | null;
    },
  ) {
    const existing = await manager.findOne(TreasuryMovement, {
      where: { sourceType: params.sourceType, sourceId: params.sourceId },
      relations: { allocations: true },
    });
    if (existing) return existing;

    if (!Array.isArray(params.allocations) || params.allocations.length === 0) {
      throw new BadRequestException('Debe indicar al menos una cuenta de Tesorería');
    }

    const normalized = params.allocations.map((item) => ({
      accountId: Number(item.accountId),
      amount: Math.abs(Number(item.amount)),
      paymentMethod: item.paymentMethod,
      reference: item.reference ?? null,
    }));

    if (
      normalized.some(
        (item) =>
          !Number.isInteger(item.accountId) ||
          item.accountId <= 0 ||
          !Number.isFinite(item.amount) ||
          item.amount <= 0,
      )
    ) {
      throw new BadRequestException('La distribución de Tesorería contiene datos inválidos');
    }

    const accountIds = [...new Set(normalized.map((item) => item.accountId))];
    const accounts = await manager
      .createQueryBuilder(TreasuryAccount, 'account')
      .where('account.id IN (:...accountIds)', { accountIds })
      .getMany();

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('Una o más cuentas de Tesorería no existen');
    }
    if (accounts.some((account) => !account.isActive)) {
      throw new BadRequestException('Una o más cuentas de Tesorería están inactivas');
    }
    if (accounts.some((account) => account.company !== params.company)) {
      throw new BadRequestException(
        'Todas las cuentas de Tesorería deben pertenecer a la empresa de la operación',
      );
    }

    const totalAmount = normalized.reduce((sum, item) => sum + item.amount, 0);
    const movement = await manager.save(
      manager.create(TreasuryMovement, {
        company: params.company,
        type: params.type,
        movementDate: params.movementDate,
        totalAmount,
        categoryId: null,
        counterparty: params.counterparty ?? null,
        description: params.description,
        reference: params.reference ?? null,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        loanId: params.loanId ?? null,
        installmentId: params.installmentId ?? null,
        paymentId: params.paymentId ?? null,
        saleId: params.saleId ?? null,
        clientId: params.clientId ?? null,
        attachmentPath: null,
        createdBy: params.createdBy,
      }),
    );

    const sign = params.type === TreasuryMovementType.EXPENSE ? -1 : 1;
    await manager.save(
      TreasuryAllocation,
      normalized.map((item) =>
        manager.create(TreasuryAllocation, {
          movementId: movement.id,
          accountId: item.accountId,
          amount: sign * item.amount,
          paymentMethod: item.paymentMethod,
          reference: item.reference ?? params.reference ?? null,
        }),
      ),
    );

    return manager.findOne(TreasuryMovement, {
      where: { id: movement.id },
      relations: { allocations: true },
    });
  }

  createAccount(dto: CreateTreasuryAccountDto) { return this.accounts.save(this.accounts.create({ ...dto, currency: dto.currency || 'ARS' })); }
  findAccounts(company?: TreasuryCompany, includeInactive = false) {
    const qb = this.accounts.createQueryBuilder('a').orderBy('a.company', 'ASC').addOrderBy('a.name', 'ASC');
    if (company) qb.andWhere('a.company = :company', { company });
    if (!includeInactive) qb.andWhere('a.isActive = true');
    return qb.getMany();
  }
  async updateAccount(id: number, dto: UpdateTreasuryAccountDto) {
    const account = await this.accounts.findOneBy({ id }); if (!account) throw new NotFoundException('Cuenta no encontrada');
    Object.assign(account, dto); return this.accounts.save(account);
  }
  async deactivateAccount(id: number) { const a = await this.accounts.findOneBy({ id }); if (!a) throw new NotFoundException('Cuenta no encontrada'); a.isActive = false; return this.accounts.save(a); }

  createCategory(dto: CreateTreasuryCategoryDto) { return this.categories.save(this.categories.create({ ...dto, company: dto.company || null, parentId: dto.parentId || null, sortOrder: dto.sortOrder || 0 })); }
  findCategories(type?: TreasuryMovementType, company?: TreasuryCompany, includeInactive = false) {
    const qb = this.categories.createQueryBuilder('c').orderBy('c.sortOrder', 'ASC').addOrderBy('c.name', 'ASC');
    if (type) qb.andWhere('c.movementType = :type', { type });
    if (company) qb.andWhere('(c.company = :company OR c.company IS NULL)', { company });
    if (!includeInactive) qb.andWhere('c.isActive = true'); return qb.getMany();
  }
  async updateCategory(id: number, dto: UpdateTreasuryCategoryDto) { const c = await this.categories.findOneBy({ id }); if (!c) throw new NotFoundException('Categoría no encontrada'); Object.assign(c, dto); return this.categories.save(c); }
  async deactivateCategory(id: number) { const c = await this.categories.findOneBy({ id }); if (!c) throw new NotFoundException('Categoría no encontrada'); c.isActive = false; return this.categories.save(c); }

  async createMovement(dto: CreateTreasuryMovementDto, userId: number, attachmentPath?: string) {
    if ([TreasuryMovementType.TRANSFER].includes(dto.type)) throw new BadRequestException('Use el endpoint de transferencias');
    if (!dto.allocations?.length) throw new BadRequestException('Debe indicar al menos una cuenta');
    const ids = [...new Set(dto.allocations.map(a => a.accountId))];
    const accounts = await this.accounts.createQueryBuilder('a').where('a.id IN (:...ids)', { ids }).getMany();
    if (accounts.length !== ids.length) throw new BadRequestException('Una o más cuentas no existen');
    if (accounts.some(a => a.company !== dto.company)) throw new BadRequestException('Todas las cuentas deben pertenecer a la empresa del movimiento');
    const total = dto.allocations.reduce((s, a) => s + Number(a.amount), 0);
    if (total <= 0) throw new BadRequestException('El importe total debe ser mayor a cero');
    const sign = dto.type === TreasuryMovementType.EXPENSE ? -1 : 1;
    return this.dataSource.transaction(async manager => {
      // IMPORTANT: do not spread dto here. dto contains `allocations` and the
      // movement relation used to have cascade enabled; spreading it caused TypeORM
      // to persist the raw allocations once and the signed ledger allocations again.
      const m = manager.create(TreasuryMovement, {
        company: dto.company,
        type: dto.type,
        movementDate: dto.movementDate,
        totalAmount: total,
        createdBy: userId,
        attachmentPath: attachmentPath || null,
        categoryId: dto.categoryId || null,
        description: dto.description,
        counterparty: dto.counterparty || null,
        reference: dto.reference || null,
        sourceType: dto.sourceType || null,
        sourceId: dto.sourceId || null,
        loanId: dto.loanId || null,
        installmentId: dto.installmentId || null,
        paymentId: dto.paymentId || null,
        saleId: dto.saleId || null,
        clientId: dto.clientId || null,
      });
      const saved = await manager.save(m);
      await manager.save(TreasuryAllocation, dto.allocations.map(a => manager.create(TreasuryAllocation, { movementId: saved.id, accountId: a.accountId, amount: sign * Number(a.amount), paymentMethod: a.paymentMethod || TreasuryPaymentMethod.OTHER, reference: a.reference || null })));
      return manager.findOne(TreasuryMovement, { where: { id: saved.id }, relations: { allocations: true } });
    });
  }

  async transfer(dto: CreateTreasuryTransferDto, userId: number) {
    if (dto.fromAccountId === dto.toAccountId) throw new BadRequestException('Las cuentas origen y destino deben ser diferentes');
    const [from, to] = await Promise.all([this.accounts.findOneBy({ id: dto.fromAccountId }), this.accounts.findOneBy({ id: dto.toAccountId })]);
    if (!from || !to) throw new NotFoundException('Cuenta origen o destino no encontrada');
    return this.dataSource.transaction(async manager => {
      const m = await manager.save(manager.create(TreasuryMovement, { company: from.company === to.company ? from.company : null, type: TreasuryMovementType.TRANSFER, movementDate: dto.movementDate, totalAmount: dto.amount, description: dto.description, reference: dto.reference || null, createdBy: userId }));
      await manager.save(TreasuryAllocation, [
        manager.create(TreasuryAllocation, { movementId: m.id, accountId: from.id, amount: -Number(dto.amount), paymentMethod: TreasuryPaymentMethod.TRANSFER, reference: dto.reference || null }),
        manager.create(TreasuryAllocation, { movementId: m.id, accountId: to.id, amount: Number(dto.amount), paymentMethod: TreasuryPaymentMethod.TRANSFER, reference: dto.reference || null }),
      ]);
      return manager.findOne(TreasuryMovement, { where: { id: m.id }, relations: { allocations: true } });
    });
  }

  async openingBalance(dto: OpeningBalanceDto, userId: number) {
    const account = await this.accounts.findOneBy({ id: dto.accountId });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('El saldo inicial no puede ser cero');

    return this.dataSource.transaction(async manager => {
      const movement = await manager.save(manager.create(TreasuryMovement, {
        company: account.company,
        type: TreasuryMovementType.OPENING_BALANCE,
        movementDate: dto.movementDate,
        totalAmount: Math.abs(amount),
        description: dto.description || `Saldo inicial - ${account.name}`,
        createdBy: userId,
      }));
      await manager.save(manager.create(TreasuryAllocation, {
        movementId: movement.id,
        accountId: account.id,
        amount,
        paymentMethod: TreasuryPaymentMethod.OTHER,
      }));
      return manager.findOne(TreasuryMovement, { where: { id: movement.id }, relations: { allocations: true } });
    });
  }

  async attachFile(id: number, attachmentPath: string) {
    const m = await this.movements.findOneBy({ id });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    m.attachmentPath = attachmentPath;
    return this.movements.save(m);
  }

  async voidMovement(id: number, userId: number, reason: string) {
    const m = await this.movements.findOneBy({ id }); if (!m) throw new NotFoundException('Movimiento no encontrado');
    if (m.status === TreasuryMovementStatus.VOIDED) throw new BadRequestException('El movimiento ya está anulado');
    m.status = TreasuryMovementStatus.VOIDED; m.voidedBy = userId; m.voidedAt = new Date(); m.voidReason = reason; return this.movements.save(m);
  }

  async findMovements(q: any) {
    const qb = this.movements.createQueryBuilder('m').leftJoinAndSelect('m.allocations', 'a').leftJoinAndSelect('a.account', 'account').orderBy('m.movementDate', 'DESC').addOrderBy('m.id', 'DESC');
    if (q.company) qb.andWhere('(m.company = :company OR (m.type = :transfer AND account.company = :company))', { company: q.company, transfer: TreasuryMovementType.TRANSFER });
    if (q.type) qb.andWhere('m.type = :type', { type: q.type }); if (q.status) qb.andWhere('m.status = :status', { status: q.status });
    if (q.from) qb.andWhere('m.movementDate >= :from', { from: q.from }); if (q.to) qb.andWhere('m.movementDate <= :to', { to: q.to });
    if (q.accountId) qb.andWhere('a.accountId = :accountId', { accountId: Number(q.accountId) });
    if (q.search) qb.andWhere('(LOWER(m.description) LIKE :s OR LOWER(COALESCE(m.counterparty,\'\')) LIKE :s OR LOWER(COALESCE(m.reference,\'\')) LIKE :s)', { s: `%${String(q.search).toLowerCase()}%` });
    return qb.take(Math.min(Number(q.limit) || 200, 500)).getMany();
  }

  async balances(company?: TreasuryCompany) {
    const qb = this.allocations.createQueryBuilder('a').innerJoin('a.movement', 'm').innerJoin('a.account', 'account').select('account.id', 'accountId').addSelect('account.name', 'accountName').addSelect('account.company', 'company').addSelect('account.type', 'accountType').addSelect('COALESCE(SUM(a.amount),0)', 'balance').where('m.status = :status', { status: TreasuryMovementStatus.POSTED });
    if (company) qb.andWhere('account.company = :company', { company });
    const rows = await qb.groupBy('account.id').addGroupBy('account.name').addGroupBy('account.company').addGroupBy('account.type').orderBy('account.company', 'ASC').addOrderBy('account.name', 'ASC').getRawMany();
    const accounts = rows.map(r => ({ ...r, accountId: Number(r.accountId), balance: Number(r.balance) }));
    return { accounts, total: accounts.reduce((s, r) => s + r.balance, 0) };
  }

  async dashboard(company?: TreasuryCompany, from?: string, to?: string) {
    const balances = await this.balances(company);
    const qb = this.movements.createQueryBuilder('m').select('m.type', 'type').addSelect('COALESCE(SUM(m.totalAmount),0)', 'amount').where('m.status = :status', { status: TreasuryMovementStatus.POSTED }).andWhere('m.type IN (:...types)', { types: [TreasuryMovementType.INCOME, TreasuryMovementType.EXPENSE] });
    if (company) qb.andWhere('m.company = :company', { company }); if (from) qb.andWhere('m.movementDate >= :from', { from }); if (to) qb.andWhere('m.movementDate <= :to', { to });
    const raw = await qb.groupBy('m.type').getRawMany(); let income = 0, expense = 0; for (const r of raw) r.type === TreasuryMovementType.INCOME ? income = Number(r.amount) : expense = Number(r.amount);
    return { ...balances, income, expense, netFlow: income - expense };
  }
}
