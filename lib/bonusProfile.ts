/** Bonus allocation profile — post-tax bonus timing and category splits. */

export type BonusFrequency = 'annual' | 'semiannual' | 'none';

export interface BonusAllocations {
  debtPayoff: number;
  emergencyFund: number;
  homeDownPayment: number;
  brokerage: number;
  rothIra: number;
  cash: number;
}

export interface BonusProfile {
  annualBonusAmount: number;
  bonusMonth: number;
  frequency: BonusFrequency;
  secondBonusAmount: number;
  secondBonusMonth: number;
  allocations: BonusAllocations;
}

export interface BonusAllocationAmounts {
  debtPayoff: number;
  emergencyFund: number;
  homeDownPayment: number;
  brokerage: number;
  rothIra: number;
  cash: number;
  total: number;
}

export const DEFAULT_BONUS_PROFILE: BonusProfile = {
  annualBonusAmount: 0,
  bonusMonth: 2,
  frequency: 'annual',
  secondBonusAmount: 0,
  secondBonusMonth: 8,
  allocations: {
    debtPayoff: 40,
    emergencyFund: 10,
    homeDownPayment: 20,
    brokerage: 20,
    rothIra: 0,
    cash: 10,
  },
};

const ALLOC_KEYS: (keyof BonusAllocations)[] = [
  'debtPayoff',
  'emergencyFund',
  'homeDownPayment',
  'brokerage',
  'rothIra',
  'cash',
];

/** Normalize percentages to integers summing to 100 (proportional). */
export function normalizeBonusAllocations(a: BonusAllocations): BonusAllocations {
  const raw = ALLOC_KEYS.map((k) => Math.max(0, Math.round(Number(a[k]) || 0)));
  const sum = raw.reduce((s, v) => s + v, 0);
  if (sum <= 0) return { ...DEFAULT_BONUS_PROFILE.allocations };
  const scaled = raw.map((v) => Math.floor((v / sum) * 100));
  let drift = 100 - scaled.reduce((s, v) => s + v, 0);
  let i = 0;
  while (drift !== 0 && i < 200) {
    const idx = i % scaled.length;
    if (drift > 0) {
      scaled[idx] += 1;
      drift -= 1;
    } else if (scaled[idx] > 0) {
      scaled[idx] -= 1;
      drift += 1;
    }
    i += 1;
  }
  return Object.fromEntries(ALLOC_KEYS.map((k, j) => [k, scaled[j]])) as unknown as BonusAllocations;
}

export function splitBonusAllocations(
  lumpPostTax: number,
  allocations: BonusAllocations,
): BonusAllocationAmounts {
  const lump = Math.max(0, lumpPostTax);
  const a = allocations;
  const round = (pct: number) => Math.round((lump * pct) / 100);
  const parts = {
    debtPayoff: round(a.debtPayoff),
    emergencyFund: round(a.emergencyFund),
    homeDownPayment: round(a.homeDownPayment),
    brokerage: round(a.brokerage),
    rothIra: round(a.rothIra),
    cash: round(a.cash),
  };
  const sumParts =
    parts.debtPayoff +
    parts.emergencyFund +
    parts.homeDownPayment +
    parts.brokerage +
    parts.rothIra +
    parts.cash;
  const drift = Math.round(lump) - sumParts;
  return {
    ...parts,
    cash: parts.cash + drift,
    total: Math.round(lump),
  };
}

/** Dollar splits for the primary annual bonus amount (summary / annual mode). */
export function getBonusAllocationAmounts(profile: BonusProfile): BonusAllocationAmounts {
  return splitBonusAllocations(profile.annualBonusAmount, profile.allocations);
}

export function getBonusMonths(profile: BonusProfile): number[] {
  if (profile.frequency === 'none') return [];
  if (profile.frequency === 'semiannual') {
    const m = [profile.bonusMonth, profile.secondBonusMonth];
    return [...new Set(m)].sort((a, b) => a - b);
  }
  return [profile.bonusMonth];
}

export function isBonusMonth(month: number, profile: BonusProfile): boolean {
  return getBonusMonths(profile).includes(month);
}

export function getBonusAmountForMonth(month: number, profile: BonusProfile): number {
  if (profile.frequency === 'none') return 0;
  if (profile.bonusMonth === month) return Math.max(0, profile.annualBonusAmount);
  if (
    profile.frequency === 'semiannual' &&
    profile.secondBonusMonth === month
  ) {
    return Math.max(0, profile.secondBonusAmount);
  }
  return 0;
}

/** Debt payoff dollars from bonus in a given calendar month. */
export function getBonusDebtPortionForMonth(month: number, profile: BonusProfile): number {
  const lump = getBonusAmountForMonth(month, profile);
  if (lump <= 0) return 0;
  return splitBonusAllocations(lump, profile.allocations).debtPayoff;
}

export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

/** Next occurrence label for UI copy. */
/** Sum of brokerage (or any allocation key) across all bonus payouts in a year. */
export function getAnnualCategoryBonusTotal(
  profile: BonusProfile,
  key: keyof BonusAllocations,
): number {
  if (profile.frequency === 'none') return 0;
  let t = 0;
  for (const m of getBonusMonths(profile)) {
    const lump = getBonusAmountForMonth(m, profile);
    if (lump <= 0) continue;
    const split = splitBonusAllocations(lump, profile.allocations);
    t += split[key];
  }
  return t;
}

/** Total post-tax bonus cash received per calendar year (annual + both semi-annual lumps). */
export function getTotalAnnualBonusPostTax(profile: BonusProfile): number {
  if (profile.frequency === 'none') return 0;
  if (profile.frequency === 'semiannual') {
    return Math.max(0, profile.annualBonusAmount) + Math.max(0, profile.secondBonusAmount);
  }
  return Math.max(0, profile.annualBonusAmount);
}

export function getNextBonusDescription(profile: BonusProfile): string {
  if (profile.frequency === 'none' || getBonusMonths(profile).length === 0) return '';
  const now = new Date();
  const y = now.getFullYear();
  const months = getBonusMonths(profile);
  let best: Date | null = null;
  for (let yr = y; yr <= y + 1; yr += 1) {
    for (const m of months) {
      const d = new Date(yr, m - 1, 1);
      if (d >= new Date(now.getFullYear(), now.getMonth(), 1)) {
        if (!best || d < best) best = d;
      }
    }
  }
  if (!best) return '';
  return best.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
