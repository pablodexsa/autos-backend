const HOLIDAYS_AR = [
  '2025-01-01',
  '2025-03-24',
  '2025-04-02',
  '2025-05-01',
  '2025-05-25',
  '2025-07-09',
  '2025-12-25',
];

function isHoliday(date: Date): boolean {
  const ymd = date.toISOString().slice(0, 10);
  return HOLIDAYS_AR.includes(ymd);
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0) return false; // domingo
  if (isHoliday(date)) return false;
  return true; // lunes a sábado
}

export function addBusinessHours(start: Date, hours: number): Date {
  let remaining = hours;
  let current = new Date(start);

  while (remaining > 0) {
    current.setHours(current.getHours() + 1);

    if (isBusinessDay(current)) {
      remaining--;
    }
  }

  return current;
}
