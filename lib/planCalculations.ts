import { calculatePaycheck, PAY_PERIODS } from '@/lib/calculations/paycheck';
import type { PaycheckResult } from '@/lib/calculations/paycheck';
import { simulateDebtPayoff } from '@/lib/calculations/debt';
import type { Debt, DebtResult } from '@/lib/calculations/debt';
import { simulateInvestment } from '@/lib/calculations/invest';
import type { InvestResult } from '@/lib/calculations/invest';
import type { PlanInputs, PlanDebt, Goal } from '@/types/plan';

export interface WaterfallEntry {
  name: string;
  value: number;     // positive = adds, negative = subtracts
  running: number;   // cumulative total after this bar
  type: 'income' | 'deduction' | 'tax' | 'expense' | 'result';
}

export interface TaxSuggestion {
  label: string;
  currentAnnual: number;
  maxAnnual: number;
  additionalSavings: number; // annual tax savings if maxed
  points: number;
}

export interface PriorityCard {
  goal: Goal;
  rank: number;
  headline: string;
  body: string;
  action: string;
  href: string;
  color: 'red' | 'yellow' | 'green' | 'blue';
}

export interface ProjectionMonth {
  month: number;
  label: string; // "Jan 2025"
  debtBalance: number;
  savingsBalance: number;
  passiveIncome: number;
  milestone?: string;
}

export interface PlanMetrics {
  // Hero numbers
  monthlyTakeHome: number;
  monthlyBonus: number;
  totalMonthlyExpenses: number;
  monthlySurplus: number;
  savingsRate: number; // % of take-home

  // Tax
  paycheckResult: PaycheckResult;
  effectiveTotalRate: number; // all taxes / gross

  // Debt
  hasDebts: boolean;
  debtResult: DebtResult | null;
  debtFreeDate: string | null;
  totalDebtBalance: number;
  monthlyDebtMinimums: number;

  // Investments
  monthlyInvestCapacity: number;
  investResult: InvestResult | null;

  // Tax efficiency
  taxEfficiencyScore: number; // 0-100
  taxSuggestions: TaxSuggestion[];

  // Waterfall chart
  waterfallData: WaterfallEntry[];

  // Priority action cards
  priorities: PriorityCard[];

  // 12-month projection
  projection: ProjectionMonth[];

  // Emergency fund
  emergencyFundMonthsCovered: number; // months of expenses covered by surplus
  emergencyFundDate: string | null;
}

function sumExpenses(e: PlanInputs['expenses']): number {
  return (
    e.housing + e.utilities + e.groceries + e.dining +
    e.transportation + e.subscriptions + e.phone +
    e.health + e.travel + e.misc
  );
}

function planDebtToDebt(pd: PlanDebt): Debt {
  return {
    id: pd.id,
    name: pd.name,
    balance: pd.balance,
    apr: pd.apr,
    minPayment: pd.minPayment,
  };
}

function formatMonthYear(isoYM: string): string {
  const [y, m] = isoYM.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function addMonths(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

function taxEfficiency(inputs: PlanInputs, paycheckResult: PaycheckResult, periods: number): {
  score: number;
  suggestions: TaxSuggestion[];
} {
  const marginal = paycheckResult.marginalFederalRate;
  const stateRate = paycheckResult.stateEffectiveRate;
  const ficaRate = 0.0765; // SS + Medicare

  const annualHSA = inputs.hsaPerPeriod * periods;
  const annualFSA = inputs.fsaPerPeriod * periods;
  const annualCommuter = inputs.commuterBenefitPerPeriod * periods;

  // 2025 limits
  const HSA_MAX = 4300;
  const FSA_MAX = 3300;
  const COMMUTER_MAX = 3780; // $315/mo × 12
  const K401_FULL_PCT = 15; // "maxed" benchmark

  // Scores (out of 100)
  const hsaScore = Math.min(annualHSA / HSA_MAX, 1) * 40;
  const k401Raw = inputs.traditional401kPct + inputs.roth401kPct;
  const k401Score = Math.min(k401Raw / K401_FULL_PCT, 1) * 35;
  const fsaScore = Math.min(annualFSA / FSA_MAX, 1) * 15;
  const commuterScore = Math.min(annualCommuter / COMMUTER_MAX, 1) * 10;

  const totalScore = Math.round(hsaScore + k401Score + fsaScore + commuterScore);

  const suggestions: TaxSuggestion[] = [];

  if (annualHSA < HSA_MAX) {
    const gap = HSA_MAX - annualHSA;
    // HSA saves income tax + FICA (triple tax advantaged)
    suggestions.push({
      label: 'Max your HSA',
      currentAnnual: annualHSA,
      maxAnnual: HSA_MAX,
      additionalSavings: Math.round(gap * (marginal + stateRate + ficaRate)),
      points: Math.round((1 - annualHSA / HSA_MAX) * 40),
    });
  }

  if (k401Raw < K401_FULL_PCT) {
    const gap = Math.max(0, K401_FULL_PCT - k401Raw);
    const annualGap = (inputs.annualSalary * gap) / 100;
    suggestions.push({
      label: `Increase 401(k) by ${gap.toFixed(0)}%`,
      currentAnnual: (inputs.annualSalary * k401Raw) / 100,
      maxAnnual: (inputs.annualSalary * K401_FULL_PCT) / 100,
      additionalSavings: Math.round(annualGap * (marginal + stateRate)),
      points: Math.round((gap / K401_FULL_PCT) * 35),
    });
  }

  if (annualFSA < FSA_MAX && annualHSA === 0) {
    const gap = FSA_MAX - annualFSA;
    suggestions.push({
      label: 'Contribute to FSA',
      currentAnnual: annualFSA,
      maxAnnual: FSA_MAX,
      additionalSavings: Math.round(gap * (marginal + stateRate + ficaRate)),
      points: Math.round((1 - annualFSA / FSA_MAX) * 15),
    });
  }

  if (annualCommuter < COMMUTER_MAX) {
    const gap = COMMUTER_MAX - annualCommuter;
    suggestions.push({
      label: 'Use commuter benefit',
      currentAnnual: annualCommuter,
      maxAnnual: COMMUTER_MAX,
      additionalSavings: Math.round(gap * (marginal + stateRate + ficaRate)),
      points: Math.round((1 - annualCommuter / COMMUTER_MAX) * 10),
    });
  }

  return { score: totalScore, suggestions };
}

function buildPriorities(
  inputs: PlanInputs,
  metrics: Partial<PlanMetrics>,
): PriorityCard[] {
  const cards: PriorityCard[] = [];
  let rank = 1;

  const surplus = metrics.monthlySurplus ?? 0;
  const debtResult = metrics.debtResult;
  const debtFreeDate = metrics.debtFreeDate;

  if (inputs.goals.includes('pay-debt') && debtResult && inputs.debts.length > 0) {
    const months = debtResult.monthsToPayoff;
    const interestSaved = Math.round(debtResult.interestSavedVsMinimum);
    cards.push({
      goal: 'pay-debt',
      rank: rank++,
      headline: 'Pay off your debt',
      body: `Debt-free in ${months} months${debtFreeDate ? ` (${formatMonthYear(debtFreeDate)})` : ''}. You'll save ${interestSaved > 0 ? `$${interestSaved.toLocaleString()} vs. minimums-only` : 'as much as possible'}.`,
      action: 'Adjust payment',
      href: '/debt',
      color: 'red',
    });
  }

  if (inputs.goals.includes('emergency-fund')) {
    const monthsToFund = inputs.emergencyFundTarget > 0 && surplus > 0
      ? Math.ceil(inputs.emergencyFundTarget / surplus)
      : null;
    const covered = metrics.emergencyFundMonthsCovered ?? 0;
    cards.push({
      goal: 'emergency-fund',
      rank: rank++,
      headline: `Build $${inputs.emergencyFundTarget.toLocaleString()} emergency fund`,
      body: monthsToFund
        ? `Saving $${Math.round(surplus).toLocaleString()}/mo, you'll hit your target in ${monthsToFund} months. Current coverage: ${covered.toFixed(1)} months of expenses.`
        : 'Set a savings rate in your plan to see your timeline.',
      action: 'See timeline',
      href: '/forecast',
      color: 'yellow',
    });
  }

  if (inputs.goals.includes('invest-income') || inputs.goals.includes('dividend-income')) {
    const investCap = metrics.monthlyInvestCapacity ?? 0;
    const annual = metrics.investResult?.annual ?? [];
    const yr3Value = annual[2]?.portfolioValue ?? 0;
    const yr3Income = annual[2]?.afterTaxAnnualIncome ?? 0;
    cards.push({
      goal: 'invest-income',
      rank: rank++,
      headline: 'Grow dividend income',
      body: investCap > 0
        ? `Investing $${Math.round(investCap).toLocaleString()}/mo generates a $${Math.round(yr3Value).toLocaleString()} portfolio and $${Math.round(yr3Income / 12).toLocaleString()}/mo in passive income after 3 years.`
        : 'Free up surplus to begin investing.',
      action: 'Run simulation',
      href: '/invest',
      color: 'green',
    });
  }

  if (inputs.goals.includes('save-home') && inputs.homeTarget > 0) {
    const monthsNeeded = surplus > 0 ? Math.ceil(inputs.homeTarget / surplus) : null;
    cards.push({
      goal: 'save-home',
      rank: rank++,
      headline: `Save $${inputs.homeTarget.toLocaleString()} for a home`,
      body: monthsNeeded
        ? `At $${Math.round(surplus).toLocaleString()}/mo savings you'll hit your target in ${monthsNeeded} months${inputs.homeTimelineMonths ? ` (goal: ${inputs.homeTimelineMonths} months)` : ''}.`
        : 'Update your expenses to free up more savings.',
      action: 'View forecast',
      href: '/forecast',
      color: 'blue',
    });
  }

  if (inputs.goals.includes('tax-efficiency')) {
    const score = metrics.taxEfficiencyScore ?? 0;
    const suggestions = metrics.taxSuggestions ?? [];
    const potentialSavings = suggestions.reduce((s, t) => s + t.additionalSavings, 0);
    cards.push({
      goal: 'tax-efficiency',
      rank: rank++,
      headline: `Boost tax efficiency (score: ${score}/100)`,
      body: potentialSavings > 0
        ? `You could save $${potentialSavings.toLocaleString()} more per year in taxes by optimizing your pre-tax contributions.`
        : 'Your pre-tax contributions are well optimized.',
      action: 'See tax details',
      href: '/paycheck',
      color: 'blue',
    });
  }

  if (inputs.goals.includes('retire-early')) {
    const investCap = metrics.monthlyInvestCapacity ?? 0;
    cards.push({
      goal: 'retire-early',
      rank: rank++,
      headline: 'Plan for early retirement',
      body: investCap > 0
        ? `Investing $${Math.round(investCap).toLocaleString()}/mo at a 7% return builds significant retirement wealth. Use the Forecaster to model your timeline.`
        : 'Reduce expenses or debt to free up investment capacity.',
      action: 'Model scenarios',
      href: '/forecast',
      color: 'green',
    });
  }

  return cards;
}

function build12MonthProjection(
  inputs: PlanInputs,
  monthlySurplus: number,
  debtResult: DebtResult | null,
  investResult: InvestResult | null,
  expensesTotal: number,
): ProjectionMonth[] {
  const now = new Date();
  const months: ProjectionMonth[] = [];

  let savingsBalance = 0;

  for (let i = 0; i < 12; i++) {
    const date = addMonths(now, i);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const snap = debtResult?.snapshots[i];
    const debtBalance = snap?.totalBalance ?? 0;

    const investPt = investResult?.monthly[i];
    const passiveIncome = investPt?.grossMonthlyIncome ?? 0;

    // Savings grows by surplus each month
    savingsBalance += Math.max(0, monthlySurplus);

    const milestones: string[] = [];

    if (debtResult && i > 0 && debtResult.snapshots[i - 1]?.totalBalance > 0 && debtBalance <= 0) {
      milestones.push('Debt paid off!');
    }
    if (inputs.emergencyFundTarget > 0 && savingsBalance >= inputs.emergencyFundTarget && (i === 0 || savingsBalance - Math.max(0, monthlySurplus) < inputs.emergencyFundTarget)) {
      milestones.push(`Emergency fund complete ($${inputs.emergencyFundTarget.toLocaleString()})`);
    }
    if (passiveIncome >= 500 && (i === 0 || (investResult?.monthly[i - 1]?.grossMonthlyIncome ?? 0) < 500)) {
      milestones.push('$500/mo passive income');
    }

    months.push({
      month: i + 1,
      label,
      debtBalance: Math.max(0, debtBalance),
      savingsBalance: Math.round(savingsBalance),
      passiveIncome: Math.round(passiveIncome * 100) / 100,
      milestone: milestones.length > 0 ? milestones.join(' · ') : undefined,
    });
  }

  return months;
}

export function computePlanMetrics(inputs: PlanInputs): PlanMetrics {
  const periods = PAY_PERIODS[inputs.payPeriod];

  // ── Paycheck ──
  const paycheckResult = calculatePaycheck({
    annualSalary: inputs.annualSalary,
    payPeriod: inputs.payPeriod,
    filingStatus: inputs.filingStatus,
    state: inputs.state,
    nycResident: inputs.nycResident,
    traditional401kPct: inputs.traditional401kPct,
    hsaPerPeriod: inputs.hsaPerPeriod,
    fsaPerPeriod: inputs.fsaPerPeriod,
    healthInsurancePerPeriod: inputs.healthInsurancePerPeriod,
    dentalPerPeriod: inputs.dentalPerPeriod,
    commuterBenefitPerPeriod: inputs.commuterBenefitPerPeriod,
    roth401kPct: inputs.roth401kPct,
    otherPostTaxPerPeriod: inputs.otherPreTaxPerPeriod, // includes "other pre-tax"
  });

  const monthlyTakeHome = (paycheckResult.netPay * periods) / 12;
  const monthlyBonus = inputs.annualBonus / 12;
  const totalMonthlyExpenses = sumExpenses(inputs.expenses);
  const monthlySurplus = monthlyTakeHome + monthlyBonus - totalMonthlyExpenses;
  const savingsRate = monthlyTakeHome > 0 ? (monthlySurplus / monthlyTakeHome) * 100 : 0;

  const effectiveTotalRate =
    inputs.annualSalary > 0
      ? (paycheckResult.totalTaxes * periods) / inputs.annualSalary
      : 0;

  // ── Waterfall ──
  const monthlyGross = inputs.annualSalary / 12;
  const monthlyPreTax = (paycheckResult.totalPreTax * periods) / 12;
  const monthlyTaxes = (paycheckResult.totalTaxes * periods) / 12;
  const monthlyNet = monthlyTakeHome;

  const waterfallData: WaterfallEntry[] = [
    { name: 'Gross Salary', value: monthlyGross, running: monthlyGross, type: 'income' },
    { name: 'Pre-Tax Deductions', value: -monthlyPreTax, running: monthlyGross - monthlyPreTax, type: 'deduction' },
    { name: 'Taxes', value: -monthlyTaxes, running: monthlyNet, type: 'tax' },
    { name: 'Net Pay', value: 0, running: monthlyNet, type: 'result' },
    { name: 'Expenses', value: -totalMonthlyExpenses, running: monthlyNet - totalMonthlyExpenses, type: 'expense' },
    { name: 'Monthly Surplus', value: 0, running: monthlySurplus, type: 'result' },
  ];

  // ── Debts ──
  const activeDebts = inputs.debts.filter((d) => d.balance > 0);
  const debts: Debt[] = activeDebts.map(planDebtToDebt);
  const hasDebts = debts.length > 0;
  const monthlyDebtMinimums = debts.reduce((s, d) => s + d.minPayment, 0);
  const totalDebtBalance = debts.reduce((s, d) => s + d.balance, 0);

  const debtResult = hasDebts
    ? simulateDebtPayoff(debts, 0, 0, 2, 'avalanche')
    : null;
  const debtFreeDate = debtResult?.debtFreeDate ?? null;

  // ── Investments ──
  const monthlyInvestCapacity = Math.max(0, monthlySurplus - monthlyDebtMinimums);

  const investResult =
    monthlyInvestCapacity > 0
      ? simulateInvestment({
          monthlyBuy: monthlyInvestCapacity,
          annualBonus: 0,
          dividendYield: 7,
          taxRate: Math.round(paycheckResult.marginalFederalRate * 100),
          qualifiedPercent: 70,
          payFrequency: 'monthly',
          years: 5,
          annualAppreciation: 3,
        })
      : null;

  // ── Tax Efficiency ──
  const { score: taxEfficiencyScore, suggestions: taxSuggestions } = taxEfficiency(
    inputs,
    paycheckResult,
    periods,
  );

  // ── Emergency fund ──
  const emergencyFundMonthsCovered =
    totalMonthlyExpenses > 0 ? monthlySurplus / totalMonthlyExpenses : 0;
  let emergencyFundDate: string | null = null;
  if (inputs.emergencyFundTarget > 0 && monthlySurplus > 0) {
    const monthsNeeded = Math.ceil(inputs.emergencyFundTarget / monthlySurplus);
    const target = addMonths(new Date(), monthsNeeded);
    emergencyFundDate = target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // ── Priority cards (partial metrics needed first) ──
  const partialMetrics: Partial<PlanMetrics> = {
    monthlySurplus,
    debtResult,
    debtFreeDate,
    monthlyInvestCapacity,
    investResult,
    taxEfficiencyScore,
    taxSuggestions,
    emergencyFundMonthsCovered,
  };
  const priorities = buildPriorities(inputs, partialMetrics);

  // ── 12-month projection ──
  const projection = build12MonthProjection(
    inputs,
    monthlySurplus,
    debtResult,
    investResult,
    totalMonthlyExpenses,
  );

  return {
    monthlyTakeHome,
    monthlyBonus,
    totalMonthlyExpenses,
    monthlySurplus,
    savingsRate,
    paycheckResult,
    effectiveTotalRate,
    hasDebts,
    debtResult,
    debtFreeDate,
    totalDebtBalance,
    monthlyDebtMinimums,
    monthlyInvestCapacity,
    investResult,
    taxEfficiencyScore,
    taxSuggestions,
    waterfallData,
    priorities,
    projection,
    emergencyFundMonthsCovered,
    emergencyFundDate,
  };
}
