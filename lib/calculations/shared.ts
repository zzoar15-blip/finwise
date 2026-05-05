export const EPSILON = 0.01;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toMonthlyRate(annualRate: number): number {
  return Math.max(0, annualRate) / 12;
}

export function pmt(principal: number, monthlyRate: number, months: number): number {
  const safeMonths = Math.max(1, Math.round(months));
  if (principal <= 0) return 0;
  if (monthlyRate <= 0) return principal / safeMonths;
  const growth = Math.pow(1 + monthlyRate, safeMonths);
  return (principal * monthlyRate * growth) / (growth - 1);
}

export function binarySearchMax(
  low: number,
  high: number,
  iterations: number,
  predicate: (value: number) => boolean,
): number {
  let lo = low;
  let hi = high;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) / 2;
    if (predicate(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function yearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(ym: string, offset: number): string {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  return yearMonth(date);
}

export function diffMonths(startYm: string, endYm: string): number {
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm));
}
