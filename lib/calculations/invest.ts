import { yearMonth } from '@/lib/calculations/shared';

export interface InvestInputs {
  monthlyBuy: number;
  annualBonus: number; /** Legacy: single deposit in February when bonusCalendarDeposits unset */
  /**
   * Optional map of calendar month (1–12) → brokerage deposit from bonus allocation.
   * When set, overrides February-only annualBonus timing.
   */
  bonusCalendarDeposits?: Partial<Record<number, number>>;
  dividendYield: number; // annual %
  taxRate: number; // marginal ordinary income tax rate %
  qualifiedPercent: number; // % of dividends that are qualified
  payFrequency: 'monthly' | 'quarterly';
  years: number; // 3-12
  annualAppreciation: number; // price appreciation %/year
}

export interface MonthPoint {
  month: number;
  date: string; // "YYYY-MM"
  portfolioValue: number;
  grossMonthlyIncome: number; // dividend income this month (0 in non-pay months for quarterly)
  afterTaxMonthlyIncome: number;
  isBonus: boolean;
  isYearEnd: boolean;
  year: number;
}

export interface AnnualPoint {
  year: number;
  portfolioValue: number;
  grossAnnualIncome: number;
  afterTaxAnnualIncome: number;
  totalInvested: number;
}

export interface MilestoneRow {
  date: string;
  label: string;
  portfolioValue: number;
  grossMonthlyIncome: number;
  afterTaxMonthlyIncome: number;
}

export interface TargetRow {
  monthlyTarget: number;
  byYield: Array<{ yield: number; portfolioNeeded: number; afterTaxPortfolioNeeded: number }>;
}

export interface InvestResult {
  monthly: MonthPoint[];
  annual: AnnualPoint[];
  milestones: MilestoneRow[];
  portfolioTargets: TargetRow[];
  effectiveDividendTaxRate: number;
}

function qualifiedDividendRate(ordinaryRate: number): number {
  if (ordinaryRate <= 12) return 0;
  if (ordinaryRate <= 35) return 0.15;
  return 0.20;
}

export function simulateInvestment(inp: InvestInputs): InvestResult {
  const totalMonths = inp.years * 12;
  const monthlyAppreciation = inp.annualAppreciation / 100 / 12;
  const monthlyYield = inp.dividendYield / 100 / 12;
  const quarterlyYield = inp.dividendYield / 100 / 4;

  const qualRate = qualifiedDividendRate(inp.taxRate);
  const ordRate = inp.taxRate / 100;
  const qualFrac = inp.qualifiedPercent / 100;
  const effectiveTaxRate = qualFrac * qualRate + (1 - qualFrac) * ordRate;

  const monthly: MonthPoint[] = [];
  let portfolioValue = 0;

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth(); // 0-indexed

  for (let m = 0; m < totalMonths; m++) {
    const dateObj = new Date(startYear, startMonth + m + 1, 1);
    const calMonth = dateObj.getMonth() + 1; // 1-12
    const year = dateObj.getFullYear() - startYear + 1;
    const isYearEnd = calMonth === 12;

    const calendarBonus =
      inp.bonusCalendarDeposits?.[calMonth] ??
      (!inp.bonusCalendarDeposits && calMonth === 2 ? inp.annualBonus : 0);

    // Purchases
    portfolioValue += inp.monthlyBuy;
    if (calendarBonus > 0) {
      portfolioValue += calendarBonus;
    }

    // Price appreciation
    portfolioValue *= (1 + monthlyAppreciation);

    // Dividend income (NOT reinvested — taken as income)
    let grossIncome = 0;
    if (inp.payFrequency === 'monthly') {
      grossIncome = portfolioValue * monthlyYield;
    } else if ([3, 6, 9, 12].includes(calMonth)) {
      grossIncome = portfolioValue * quarterlyYield;
    }
    const afterTaxIncome = grossIncome * (1 - effectiveTaxRate);

    monthly.push({
      month: m + 1,
      date: yearMonth(dateObj),
      portfolioValue,
      grossMonthlyIncome: grossIncome,
      afterTaxMonthlyIncome: afterTaxIncome,
      isBonus: calendarBonus > 0,
      isYearEnd,
      year,
    });
  }

  // Annual summaries
  const annual: AnnualPoint[] = [];
  for (let y = 1; y <= inp.years; y++) {
    const yearMonths = monthly.filter(m => m.year === y);
    const last = yearMonths[yearMonths.length - 1];
    annual.push({
      year: y,
      portfolioValue: last?.portfolioValue ?? 0,
      grossAnnualIncome: yearMonths.reduce((s, m) => s + m.grossMonthlyIncome, 0),
      afterTaxAnnualIncome: yearMonths.reduce((s, m) => s + m.afterTaxMonthlyIncome, 0),
      totalInvested:
        y * inp.monthlyBuy * 12 +
        (() => {
          if (inp.bonusCalendarDeposits) {
            const annualBonusSum = Object.values(inp.bonusCalendarDeposits).reduce<number>(
              (acc, v) => acc + (v ?? 0),
              0,
            );
            return y * annualBonusSum;
          }
          return inp.annualBonus > 0 ? y * inp.annualBonus : 0;
        })(),
    });
  }

  // Milestones: February and December months
  const milestones: MilestoneRow[] = monthly
    .filter(m => m.isBonus || m.isYearEnd)
    .map(m => ({
      date: m.date,
      label: m.isBonus ? `Bonus ${m.date}` : `Dec ${m.date.slice(0, 4)}`,
      portfolioValue: m.portfolioValue,
      grossMonthlyIncome: m.grossMonthlyIncome,
      afterTaxMonthlyIncome: m.afterTaxMonthlyIncome,
    }));

  // Portfolio needed for income targets at different yields
  const TARGETS = [1000, 2000, 5000, 10000];
  const YIELDS = [4, 6, 8, 10, 12];
  const portfolioTargets: TargetRow[] = TARGETS.map(target => ({
    monthlyTarget: target,
    byYield: YIELDS.map(y => ({
      yield: y,
      portfolioNeeded: (target * 12) / (y / 100),
      afterTaxPortfolioNeeded: (target * 12) / (y / 100 * (1 - effectiveTaxRate)),
    })),
  }));

  return { monthly, annual, milestones, portfolioTargets, effectiveDividendTaxRate: effectiveTaxRate };
}
