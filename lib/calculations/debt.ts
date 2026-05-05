import { EPSILON, yearMonth } from '@/lib/calculations/shared';

export interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number; // annual %
  minPayment: number;
}

export interface MonthSnapshot {
  month: number;
  date: string; // "YYYY-MM"
  balances: Record<string, number>;
  totalBalance: number;
  cumulativeInterest: number;
}

export interface DebtResult {
  snapshots: MonthSnapshot[];
  monthsToPayoff: number;
  totalInterestPaid: number;
  interestSavedVsMinimum: number;
  debtFreeDate: string; // "YYYY-MM"
}

export interface SensitivityRow {
  extraPerMonth: number;
  monthsToPayoff: number;
  totalInterest: number;
  interestSaved: number;
}

function runSimulation(
  debts: Debt[],
  monthlyBudget: number, // total payment budget including minimums
  bonusDebtForCalendarMonth: (calendarMonth: number) => number,
  strategy: 'avalanche' | 'snowball',
  startCalMonth: number // 1-12, the month simulation begins
): { snapshots: MonthSnapshot[]; totalInterest: number } {
  const current = debts.map(d => ({ ...d }));
  const snapshots: MonthSnapshot[] = [];
  let cumulativeInterest = 0;
  const maxMonths = 600;

  for (let m = 0; m < maxMonths; m++) {
    if (!current.some(d => d.balance > EPSILON)) break;

    const calMonth = ((startCalMonth - 1 + m) % 12) + 1;
    const bonusExtra = Math.max(0, bonusDebtForCalendarMonth(calMonth));

    // Accrue interest
    let interestThisMonth = 0;
    for (const d of current) {
      if (d.balance > 0) {
        const interest = d.balance * (d.apr / 100 / 12);
        d.balance += interest;
        interestThisMonth += interest;
      }
    }
    cumulativeInterest += interestThisMonth;

    // Total available this month (minimums + extra + bonus principal toward debt)
    let available = monthlyBudget + bonusExtra;

    // Pay minimums first
    for (const d of current) {
      if (d.balance > 0 && available > 0) {
        const pay = Math.min(d.balance, d.minPayment, available);
        d.balance -= pay;
        available -= pay;
        if (d.balance < EPSILON) d.balance = 0;
      }
    }

    // Apply extra to target debt
    const active = current.filter(d => d.balance > EPSILON);
    if (strategy === 'avalanche') {
      active.sort((a, b) => b.apr - a.apr);
    } else {
      active.sort((a, b) => a.balance - b.balance);
    }
    for (const d of active) {
      if (available <= EPSILON) break;
      const pay = Math.min(d.balance, available);
      d.balance -= pay;
      available -= pay;
      if (d.balance < EPSILON) d.balance = 0;
    }

    const balances: Record<string, number> = {};
    for (const d of current) balances[d.id] = Math.max(0, d.balance);

    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() + m + 1, 1);
    snapshots.push({
      month: m + 1,
      date: yearMonth(date),
      balances,
      totalBalance: Object.values(balances).reduce((s, v) => s + v, 0),
      cumulativeInterest,
    });
  }

  return { snapshots, totalInterest: cumulativeInterest };
}

/** Bonus lump toward debt by calendar month (1–12). */
export function simulateDebtPayoffDynamic(
  debts: Debt[],
  monthlyOverpayment: number,
  bonusDebtForCalendarMonth: (calendarMonth: number) => number,
  strategy: 'avalanche' | 'snowball',
): DebtResult {
  if (!debts.length || !debts.some(d => d.balance > 0)) {
    return { snapshots: [], monthsToPayoff: 0, totalInterestPaid: 0, interestSavedVsMinimum: 0, debtFreeDate: '' };
  }

  const minBudget = debts.reduce((s, d) => s + d.minPayment, 0);
  const budget = minBudget + monthlyOverpayment;
  const startMonth = new Date().getMonth() + 1;

  const { snapshots, totalInterest } = runSimulation(
    debts, budget, bonusDebtForCalendarMonth, strategy, startMonth,
  );

  // Minimum-only simulation for comparison
  const { totalInterest: minOnlyInterest } = runSimulation(
    debts, minBudget, () => 0, strategy, startMonth,
  );

  const lastPayoffMonth = snapshots.findIndex(s => s.totalBalance < EPSILON);
  const monthsToPayoff = lastPayoffMonth >= 0 ? lastPayoffMonth + 1 : snapshots.length;
  const debtFreeDate = snapshots[monthsToPayoff - 1]?.date ?? '';

  return {
    snapshots: snapshots.slice(0, monthsToPayoff),
    monthsToPayoff,
    totalInterestPaid: totalInterest,
    interestSavedVsMinimum: Math.max(0, minOnlyInterest - totalInterest),
    debtFreeDate,
  };
}

export function simulateDebtPayoff(
  debts: Debt[],
  monthlyOverpayment: number,
  annualBonus: number,
  bonusMonth: number,
  strategy: 'avalanche' | 'snowball',
): DebtResult {
  return simulateDebtPayoffDynamic(
    debts,
    monthlyOverpayment,
    (m) => (m === bonusMonth ? annualBonus : 0),
    strategy,
  );
}

export function buildSensitivityTable(
  debts: Debt[],
  baseOverpayment: number,
  annualBonus: number,
  bonusMonth: number,
  strategy: 'avalanche' | 'snowball'
): SensitivityRow[] {
  const minBudget = debts.reduce((s, d) => s + d.minPayment, 0);
  const startMonth = new Date().getMonth() + 1;

  // Minimum-only for baseline
  const { totalInterest: minInterest } = runSimulation(
    debts, minBudget, () => 0, strategy, startMonth,
  );

  const increments = [0, 100, 200, 300, 400, 500];
  return increments.map(extra => {
    const overpayment = baseOverpayment + extra;
    const budget = minBudget + overpayment;
    const { snapshots, totalInterest } = runSimulation(
      debts,
      budget,
      (m) => (m === bonusMonth ? annualBonus : 0),
      strategy,
      startMonth,
    );
    const lastPayoff = snapshots.findIndex(s => s.totalBalance < EPSILON);
    const months = lastPayoff >= 0 ? lastPayoff + 1 : snapshots.length;
    return {
      extraPerMonth: overpayment,
      monthsToPayoff: months,
      totalInterest,
      interestSaved: Math.max(0, minInterest - totalInterest),
    };
  });
}
