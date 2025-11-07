import { DataSource } from 'typeorm';
import { LoanRate } from './loan-rate.entity';

export async function seedLoanRates(dataSource: DataSource) {
  const repo = dataSource.getRepository(LoanRate);

  const existing = await repo.count();
  if (existing > 0) {
    console.log('🔹 Loan rates ya existen, no se cargan duplicados.');
    return;
  }

  const data: Partial<LoanRate>[] = [
    // 🔹 Préstamo Prendario
    { type: 'prendario', months: 6, rate: 8.5 },
    { type: 'prendario', months: 12, rate: 15.0 },
    { type: 'prendario', months: 18, rate: 21.5 },
    { type: 'prendario', months: 24, rate: 28.0 },

    // 🔹 Préstamo Personal
    { type: 'personal', months: 6, rate: 12.0 },
    { type: 'personal', months: 12, rate: 20.0 },
    { type: 'personal', months: 18, rate: 28.0 },
    { type: 'personal', months: 24, rate: 36.0 },

    // 🔹 Financiación Personal
    { type: 'financiacion', months: 6, rate: 10.0 },
    { type: 'financiacion', months: 12, rate: 18.0 },
    { type: 'financiacion', months: 18, rate: 26.0 },
    { type: 'financiacion', months: 24, rate: 33.0 },
  ];

  await repo.save(data);
  console.log('✅ Loan rates precargados correctamente.');
}
