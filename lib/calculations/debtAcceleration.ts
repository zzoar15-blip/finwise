import type { Debt } from '@/lib/calculations/debt';

const ZERO = 1e-9;
const MAX_MONTHS = 600;

export interface DebtAccelerationResult {
  monthsSaved: number;
  interestSaved: number;
  newPayoffDate: Date;
  baselineMonths: number;
  acceleratedMonths: number;
  baselineInterest: number;
  acceleratedInterest: number;
}

/**
 * Monthly amortization: accrue APR, apply each debt's minimum, then avalanche extra to highest APR.
 * Mirrors spreadsheet-style payoff (per-debt minimums + optional extra lump to target debt).
 */
function simulatePayoff(debtsInput: Debt[], extra: number): { months: number; totalInterest: number } {
  let balances: Debt[] = debtsInput
    .filter((d) => d.balance > ZERO)
    .map((d) => ({ ...d, minPayment: Math.max(0, d.minPayment), balance: Math.max(0, d.balance) }));

  let months = 0;
  let totalInterest = 0;

  while (balances.some((d) => d.balance > ZERO) && months < MAX_MONTHS) {
    months += 1;

    balances = balances.map((d) => {
      if (d.balance <= ZERO) return { ...d, balance: 0 };
      const monthlyRate = (d.apr / 100) / 12;
      const interest = d.balance * monthlyRate;
      totalInterest += interest;
      return { ...d, balance: d.balance + interest };
    });

    balances = balances.map((d) => {
      if (d.balance <= ZERO) return { ...d, balance: 0 };
      const pay = Math.min(d.minPayment, d.balance);
      return { ...d, balance: Math.max(0, d.balance - pay) };
    });

    if (extra > ZERO) {
      let remaining = extra;
      const targets = [...balances]
        .filter((d) => d.balance > ZERO)
        .sort((a, b) => b.apr - a.apr);
      for (const debt of targets) {
        if (remaining <= ZERO) break;
        const idx = balances.findIndex((d) => d.id === debt.id);
        if (idx === -1) continue;
        const pay = Math.min(remaining, balances[idx].balance);
        balances[idx] = {
          ...balances[idx],
          balance: Math.max(0, balances[idx].balance - pay),
        };
        remaining -= pay;
      }
    }

    balances = balances.map((d) => ({
      ...d,
      balance: d.balance < 0.01 ? 0 : d.balance,
    }));
  }

  return { months, totalInterest };
}

export function calcDebtAcceleration(debts: Debt[] | undefined, extraPayment: number): DebtAccelerationResult {
  const list = debts?.filter((d) => d.balance > ZERO) ?? [];
  if (!list.length) {
    const now = new Date();
    return {
      monthsSaved: 0,
      interestSaved: 0,
      newPayoffDate: now,
      baselineMonths: 0,
      acceleratedMonths: 0,
      baselineInterest: 0,
      acceleratedInterest: 0,
    };
  }

  const extra = Math.max(0, extraPayment);
  const baseline = simulatePayoff(list, 0);
  const accelerated = simulatePayoff(list, extra);

  const monthsSaved = Math.max(0, baseline.months - accelerated.months);
  const interestSaved = Math.max(0, baseline.totalInterest - accelerated.totalInterest);

  const newPayoffDate = new Date();
  newPayoffDate.setMonth(newPayoffDate.getMonth() + accelerated.months);

  return {
    monthsSaved,
    interestSaved,
    newPayoffDate,
    baselineMonths: baseline.months,
    acceleratedMonths: accelerated.months,
    baselineInterest: baseline.totalInterest,
    acceleratedInterest: accelerated.totalInterest,
  };
}
