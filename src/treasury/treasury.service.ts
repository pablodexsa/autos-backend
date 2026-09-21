import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
      const m = manager.create(TreasuryMovement, { ...dto, totalAmount: total, createdBy: userId, attachmentPath: attachmentPath || null, categoryId: dto.categoryId || null, counterparty: dto.counterparty || null, reference: dto.reference || null, sourceType: dto.sourceType || null, sourceId: dto.sourceId || null, loanId: dto.loanId || null, installmentId: dto.installmentId || null, paymentId: dto.paymentId || null, saleId: dto.saleId || null, clientId: dto.clientId || null });
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
    const a = await this.accounts.findOneBy({ id: dto.accountId }); if (!a) throw new NotFoundException('Cuenta no encontrada');
    return this.createMovement({ company: a.company, type: TreasuryMovementType.OPENING_BALANCE, movementDate: dto.movementDate, description: dto.description || `Saldo inicial - ${a.name}`, allocations: [{ accountId: a.id, amount: Math.abs(Number(dto.amount)), paymentMethod: TreasuryPaymentMethod.OTHER }] }, userId).then(async m => {
      if (Number(dto.amount) < 0 && m) { await this.allocations.update({ movementId: m.id }, { amount: -Math.abs(Number(dto.amount)) }); await this.movements.update(m.id, { totalAmount: Math.abs(Number(dto.amount)) }); }
      return this.movements.findOne({ where: { id: m!.id }, relations: { allocations: true } });
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
