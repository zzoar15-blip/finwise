import { calculatePaycheck, PAY_PERIODS } from '@/lib/calculations/paycheck';
import type { PaycheckResult } from '@/lib/calculations/paycheck';
import { simulateDebtPayoff } from '@/lib/calculations/debt';
import type { Debt, DebtResult } from '@/lib/calculations/debt';
import { simulateInvestment } from '@/lib/calculations/invest';
import type { InvestResult } from '@/lib/calculations/invest';
import type {
  StoreBudgetInputs,
  StorePaycheckInputs,
  StorePaycheckResults,
} from '@/lib/calculations';
import {
  computeBudgetSurplus,
  computeOptionalMonthlySavings,
  computeSavingsRate,
  computeTotalExpenses,
} from '@/lib/calculations';
import type { PlanInputs, PlanDebt, Goal } from '@/types/plan';
import type { ActionChecklistItem } from '@/types/plan';

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
  /** Wizard-only: surplus / take-home. With Budget Planner sync: payroll + bank savings as % of gross. */
  savingsRate: number;

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
  emergencyFundMonthsCovered: number; // months of expenses covered by current emergency fund
  emergencyFundDate: string | null;
  homeMonthlyContribution: number;
  emergencyMonthlyContribution: number;
  financialHealthScore: number;
  healthScoreBreakdown: {
    cashflow: number;
    debt: number;
    emergency: number;
    investing: number;
    tax: number;
  };
  goalWarnings: Array<{
    id: string;
    level: 'warning' | 'risk';
    title: string;
    detail: string;
    href: string;
  }>;
  actionChecklist: ActionChecklistItem[];
}

interface PlanDebtSimulationOverrides {
  monthlyOverpayment?: number;
  annualBonus?: number;
  bonusMonth?: number;
  strategy?: 'avalanche' | 'snowball';
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreFromRange(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const normalized = (value - min) / (max - min);
  return clampScore(normalized * 100);
}

function buildHealthScore(metrics: {
  monthlySurplus: number;
  monthlyTakeHome: number;
  totalDebtBalance: number;
  monthlyDebtMinimums: number;
  emergencyFundMonthsCovered: number;
  monthlyInvestCapacity: number;
  taxEfficiencyScore: number;
}): PlanMetrics['healthScoreBreakdown'] & { total: number } {
  const cashflowRatio = metrics.monthlyTakeHome > 0 ? metrics.monthlySurplus / metrics.monthlyTakeHome : 0;
  const cashflow = scoreFromRange(cashflowRatio, -0.1, 0.25);
  const debtLoad = metrics.monthlyTakeHome > 0 ? metrics.monthlyDebtMinimums / metrics.monthlyTakeHome : 0;
  const debt =
    metrics.totalDebtBalance <= 0
      ? 100
      : scoreFromRange(0.45 - debtLoad, 0, 0.4);
  const emergency = scoreFromRange(metrics.emergencyFundMonthsCovered, 0, 6);
  const investRatio = metrics.monthlyTakeHome > 0 ? metrics.monthlyInvestCapacity / metrics.monthlyTakeHome : 0;
  const investing =
    metrics.monthlyInvestCapacity <= 0
      ? 15
      : scoreFromRange(investRatio, 0, 0.2);
  const tax = clampScore(metrics.taxEfficiencyScore);
  const total = clampScore(cashflow * 0.32 + debt * 0.24 + emergency * 0.2 + investing * 0.14 + tax * 0.1);
  return { total, cashflow, debt, emergency, investing, tax };
}

function buildGoalWarnings(inputs: PlanInputs, metrics: {
  monthlySurplus: number;
  emergencyFundMonthsCovered: number;
  homeMonthlyContribution: number;
  emergencyMonthlyContribution: number;
  debtResult: DebtResult | null;
  monthlyInvestCapacity: number;
}): PlanMetrics['goalWarnings'] {
  const warnings: PlanMetrics['goalWarnings'] = [];
  if (metrics.monthlySurplus < 0) {
    warnings.push({
      id: 'negative-surplus',
      level: 'risk',
      title: 'Monthly cash flow is negative',
      detail: 'Your current plan spends more than it brings in. Goal timelines will slip until surplus is positive.',
      href: '/budget',
    });
  }
  if (inputs.goals.includes('emergency-fund') && metrics.emergencyFundMonthsCovered < 1) {
    warnings.push({
      id: 'low-emergency-coverage',
      level: 'warning',
      title: 'Emergency coverage is below one month',
      detail: 'Build buffer first to reduce disruption risk before aggressive investing or home savings.',
      href: '/forecast?focus=emergency',
    });
  }
  if (inputs.goals.includes('save-home') && inputs.homeTarget > 0 && metrics.homeMonthlyContribution > Math.max(0, metrics.monthlySurplus)) {
    warnings.push({
      id: 'home-goal-unfunded',
      level: 'warning',
      title: 'Home timeline is underfunded',
      detail: 'Required monthly home contribution exceeds available surplus under current assumptions.',
      href: '/forecast?focus=home',
    });
  }
  if (inputs.goals.includes('pay-debt') && metrics.debtResult && metrics.debtResult.monthsToPayoff > 120) {
    warnings.push({
      id: 'debt-horizon-long',
      level: 'warning',
      title: 'Debt payoff horizon is long',
      detail: 'Debt-free date is over 10 years out; consider increasing overpayment or refinancing options.',
      href: '/debt',
    });
  }
  if ((inputs.goals.includes('invest-income') || inputs.goals.includes('dividend-income')) && metrics.monthlyInvestCapacity <= 0) {
    warnings.push({
      id: 'invest-without-capacity',
      level: 'warning',
      title: 'No investable monthly capacity',
      detail: 'Investment goal is selected, but current cash flow leaves no monthly investing room.',
      href: '/invest',
    });
  }
  return warnings;
}

function buildActionChecklist(inputs: PlanInputs, metrics: {
  monthlySurplus: number;
  emergencyMonthlyContribution: number;
  homeMonthlyContribution: number;
  monthlyInvestCapacity: number;
  debtResult: DebtResult | null;
  taxSuggestions: TaxSuggestion[];
  goalWarnings: PlanMetrics['goalWarnings'];
}): ActionChecklistItem[] {
  const items: ActionChecklistItem[] = [];
  if (metrics.monthlySurplus < 0) {
    items.push({
      id: 'fix-cashflow',
      title: 'Stabilize monthly cash flow',
      rationale: 'A negative monthly surplus blocks every other goal.',
      monthlyImpact: Math.ceil(Math.abs(metrics.monthlySurplus)),
      priority: 'high',
      href: '/budget',
    });
  }
  if (inputs.goals.includes('pay-debt') && metrics.debtResult) {
    items.push({
      id: 'debt-overpay',
      title: 'Increase debt overpayment',
      rationale: 'Accelerating high-interest balances improves flexibility and reduces total interest.',
      monthlyImpact: Math.max(100, Math.round(metrics.monthlySurplus * 0.25)),
      priority: 'high',
      href: '/debt',
    });
  }
  if (inputs.goals.includes('emergency-fund') && metrics.emergencyMonthlyContribution > 0) {
    items.push({
      id: 'emergency-autosave',
      title: 'Automate emergency fund transfer',
      rationale: 'Consistent monthly transfers de-risk short-term shocks.',
      monthlyImpact: metrics.emergencyMonthlyContribution,
      priority: 'high',
      href: '/forecast?focus=emergency',
    });
  }
  if (inputs.goals.includes('save-home') && metrics.homeMonthlyContribution > 0) {
    items.push({
      id: 'home-fund',
      title: 'Fund down payment intentionally',
      rationale: 'Dedicated monthly flow keeps home timeline visible and realistic.',
      monthlyImpact: metrics.homeMonthlyContribution,
      priority: 'medium',
      href: '/forecast?focus=home',
    });
  }
  if (metrics.monthlyInvestCapacity > 0) {
    items.push({
      id: 'invest-automate',
      title: 'Automate monthly investing',
      rationale: 'Automated investing enforces consistency and compounds growth.',
      monthlyImpact: Math.round(metrics.monthlyInvestCapacity),
      priority: 'medium',
      href: '/invest',
    });
  }
  if (metrics.taxSuggestions.length > 0) {
    const top = metrics.taxSuggestions[0];
    items.push({
      id: 'tax-optimize',
      title: `Apply tax optimization: ${top.label}`,
      rationale: `Highest available immediate tax-efficiency lift (${Math.round(top.additionalSavings).toLocaleString()}/yr).`,
      monthlyImpact: Math.round(top.additionalSavings / 12),
      priority: 'medium',
      href: '/paycheck',
    });
  }
  if (metrics.goalWarnings.length === 0 && metrics.monthlySurplus > 0) {
    items.push({
      id: 'scenario-review',
      title: 'Run scenario comparison',
      rationale: 'Your baseline looks stable; compare upside/downside before committing to a path.',
      monthlyImpact: 0,
      priority: 'low',
      href: '/forecast',
    });
  }
  return items.slice(0, 6);
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
  const k401TargetPct =
    inputs.annualSalary <= 70000
      ? 8
      : inputs.annualSalary <= 120000
        ? 10
        : inputs.annualSalary <= 200000
          ? 12
          : 15;

  // Scores (out of 100)
  const hsaScore = Math.min(annualHSA / HSA_MAX, 1) * 40;
  const k401Raw = inputs.traditional401kPct + inputs.roth401kPct;
  const k401Score = Math.min(k401Raw / k401TargetPct, 1) * 35;
  const fsaScore = Math.min(annualFSA / FSA_MAX, 1) * 15;
  const commuterScore = Math.min(annualCommuter / COMMUTER_MAX, 1) * 10;

  const totalScore = clampScore(hsaScore + k401Score + fsaScore + commuterScore);

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

  if (k401Raw < k401TargetPct) {
    const gap = Math.max(0, k401TargetPct - k401Raw);
    const annualGap = (inputs.annualSalary * gap) / 100;
    suggestions.push({
      label: `Increase 401(k) by ${gap.toFixed(0)}%`,
      currentAnnual: (inputs.annualSalary * k401Raw) / 100,
      maxAnnual: (inputs.annualSalary * k401TargetPct) / 100,
      additionalSavings: Math.round(annualGap * (marginal + stateRate)),
      points: Math.round((gap / k401TargetPct) * 35),
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

  suggestions.sort((a, b) => b.additionalSavings - a.additionalSavings || b.points - a.points);

  return { score: totalScore, suggestions };
}

function buildPriorities(
  inputs: PlanInputs,
  metrics: Partial<PlanMetrics>,
): PriorityCard[] {
  const cards: PriorityCard[] = [];
  let rank = 1;

  const surplus = Math.max(0, metrics.monthlySurplus ?? 0);
  const debtResult = metrics.debtResult;
  const debtFreeDate = metrics.debtFreeDate;
  const homeMonthlyContribution = metrics.homeMonthlyContribution ?? 0;
  const emergencyMonthlyContribution = metrics.emergencyMonthlyContribution ?? 0;
  let remainingPriorityCashflow = surplus;

  const goalOrder = inputs.goals.filter((g, idx, arr) => arr.indexOf(g) === idx);
  const allocateForGoal = (preferred: number | null = null) => {
    if (remainingPriorityCashflow <= 0) return 0;
    if (preferred === null) {
      const all = remainingPriorityCashflow;
      remainingPriorityCashflow = 0;
      return all;
    }
    const allocation = Math.max(0, Math.min(remainingPriorityCashflow, preferred));
    remainingPriorityCashflow -= allocation;
    return allocation;
  };

  for (const goal of goalOrder) {
    if (goal === 'pay-debt') {
      if (!debtResult || inputs.debts.length === 0) continue;
      const months = debtResult.monthsToPayoff;
      const interestSaved = Math.round(debtResult.interestSavedVsMinimum);
      const debtCashflow = allocateForGoal(null);
      cards.push({
        goal,
        rank: rank++,
        headline: 'Pay off your debt',
        body: `Priority cash flow for debt: $${Math.round(debtCashflow).toLocaleString()}/mo. Debt-free in ${months} months${debtFreeDate ? ` (${formatMonthYear(debtFreeDate)})` : ''}. You'll save ${interestSaved > 0 ? `$${interestSaved.toLocaleString()} vs. minimums-only` : 'as much as possible'}.`,
        action: 'Adjust payment',
        href: '/debt',
        color: 'red',
      });
      continue;
    }

    if (goal === 'emergency-fund') {
      const preferredEmergency = emergencyMonthlyContribution > 0 ? emergencyMonthlyContribution : null;
      const effectiveEmergencySavings = preferredEmergency !== null
        ? allocateForGoal(preferredEmergency)
        : allocateForGoal(null);
      const monthsToFund = inputs.emergencyFundTarget > 0 && effectiveEmergencySavings > 0
        ? Math.ceil(inputs.emergencyFundTarget / effectiveEmergencySavings)
        : null;
      const covered = metrics.emergencyFundMonthsCovered ?? 0;
      cards.push({
        goal,
        rank: rank++,
        headline: `Build $${inputs.emergencyFundTarget.toLocaleString()} emergency fund`,
        body: monthsToFund
          ? `Priority cash flow for emergency fund: $${Math.round(effectiveEmergencySavings).toLocaleString()}/mo. You'll hit your target in ${monthsToFund} months. Current coverage: ${covered.toFixed(1)} months of expenses.`
          : 'Set a savings rate in your plan to see your timeline.',
        action: 'See timeline',
        href: '/forecast?focus=emergency',
        color: 'yellow',
      });
      continue;
    }

    if (goal === 'save-home' && inputs.homeTarget > 0) {
      const preferredHome = homeMonthlyContribution > 0 ? homeMonthlyContribution : null;
      const effectiveHomeSavings = preferredHome !== null
        ? allocateForGoal(preferredHome)
        : allocateForGoal(null);
      const monthsNeeded = effectiveHomeSavings > 0 ? Math.ceil(inputs.homeTarget / effectiveHomeSavings) : null;
      cards.push({
        goal,
        rank: rank++,
        headline: `Save $${inputs.homeTarget.toLocaleString()} for a home`,
        body: monthsNeeded
          ? `Priority cash flow for home goal: $${Math.round(effectiveHomeSavings).toLocaleString()}/mo, so you'll hit your target in ${monthsNeeded} months${inputs.homeTimelineMonths ? ` (goal: ${inputs.homeTimelineMonths} months)` : ''}.`
          : 'Update your expenses to free up more savings.',
        action: 'View forecast',
        href: '/forecast?focus=home',
        color: 'blue',
      });
      continue;
    }

    if (goal === 'invest-income' || goal === 'dividend-income') {
      const investCap = allocateForGoal(null);
      const annual = metrics.investResult?.annual ?? [];
      const yr3Value = annual[2]?.portfolioValue ?? 0;
      const yr3Income = annual[2]?.afterTaxAnnualIncome ?? 0;
      cards.push({
        goal,
        rank: rank++,
        headline: 'Grow dividend income',
        body: investCap > 0
          ? `Priority cash flow for investing: $${Math.round(investCap).toLocaleString()}/mo. This can generate a $${Math.round(yr3Value).toLocaleString()} portfolio and $${Math.round(yr3Income / 12).toLocaleString()}/mo in passive income after 3 years.`
          : 'Free up surplus to begin investing.',
        action: 'Run simulation',
        href: '/forecast?focus=invest',
        color: 'green',
      });
      continue;
    }

    if (goal === 'retire-early') {
      const retireCashflow = allocateForGoal(null);
      cards.push({
        goal,
        rank: rank++,
        headline: 'Plan for early retirement',
        body: retireCashflow > 0
          ? `Priority cash flow for retirement: $${Math.round(retireCashflow).toLocaleString()}/mo. Use the Forecaster to model your timeline and assumptions.`
          : 'Reduce expenses or debt to free up retirement investment capacity.',
        action: 'Model scenarios',
        href: '/forecast?focus=retire',
        color: 'green',
      });
      continue;
    }

    if (goal === 'tax-efficiency') {
      const score = metrics.taxEfficiencyScore ?? 0;
      const suggestions = metrics.taxSuggestions ?? [];
      const potentialSavings = suggestions.reduce((s, t) => s + t.additionalSavings, 0);
      cards.push({
        goal,
        rank: rank++,
        headline: `Boost tax efficiency (score: ${score}/100)`,
        body: potentialSavings > 0
          ? `You could save $${potentialSavings.toLocaleString()} more per year in taxes by optimizing your pre-tax contributions.`
          : 'Your pre-tax contributions are well optimized.',
        action: 'See tax details',
        href: '/paycheck',
        color: 'blue',
      });
      continue;
    }
  }

  return cards;
}

function build12MonthProjection(
  inputs: PlanInputs,
  monthlySurplus: number,
  debtResult: DebtResult | null,
  investResult: InvestResult | null,
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

export function computePlanMetrics(
  inputs: PlanInputs,
  debtOverrides: PlanDebtSimulationOverrides = {},
): PlanMetrics {
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
    otherPreTaxPerPeriod: inputs.otherPreTaxPerPeriod,
    roth401kPct: inputs.roth401kPct,
    otherPostTaxPerPeriod: 0,
  });

  const monthlyTakeHome = (paycheckResult.netPay * periods) / 12;
  const monthlyBonus = inputs.annualBonus / 12;
  const totalMonthlyExpenses = sumExpenses(inputs.expenses);
  const monthlySurplus = monthlyTakeHome + monthlyBonus - totalMonthlyExpenses;
  const homeMonthlyContribution =
    inputs.goals.includes('save-home') && inputs.homeTarget > 0
      ? Math.ceil(inputs.homeTarget / Math.max(1, inputs.homeTimelineMonths || 36))
      : 0;
  const emergencyMonthlyContribution =
    inputs.goals.includes('emergency-fund') && inputs.emergencyFundTarget > 0
      ? Math.ceil(inputs.emergencyFundTarget / 12)
      : 0;
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
    ? simulateDebtPayoff(
      debts,
      Math.max(0, debtOverrides.monthlyOverpayment ?? 0),
      Math.max(0, debtOverrides.annualBonus ?? 0),
      debtOverrides.bonusMonth ?? 2,
      debtOverrides.strategy ?? 'avalanche',
    )
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
    totalMonthlyExpenses > 0 ? inputs.currentEmergencyFund / totalMonthlyExpenses : 0;
  let emergencyFundDate: string | null = null;
  const remainingEmergencyTarget = Math.max(0, inputs.emergencyFundTarget - inputs.currentEmergencyFund);
  if (remainingEmergencyTarget > 0 && monthlySurplus > 0) {
    const monthsNeeded = Math.ceil(remainingEmergencyTarget / monthlySurplus);
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
    homeMonthlyContribution,
    emergencyMonthlyContribution,
  };
  const priorities = buildPriorities(inputs, partialMetrics);
  const health = buildHealthScore({
    monthlySurplus,
    monthlyTakeHome,
    totalDebtBalance,
    monthlyDebtMinimums,
    emergencyFundMonthsCovered,
    monthlyInvestCapacity,
    taxEfficiencyScore,
  });
  const goalWarnings = buildGoalWarnings(inputs, {
    monthlySurplus,
    emergencyFundMonthsCovered,
    homeMonthlyContribution,
    emergencyMonthlyContribution,
    debtResult,
    monthlyInvestCapacity,
  });
  const actionChecklist = buildActionChecklist(inputs, {
    monthlySurplus,
    emergencyMonthlyContribution,
    homeMonthlyContribution,
    monthlyInvestCapacity,
    debtResult,
    taxSuggestions,
    goalWarnings,
  });

  // ── 12-month projection ──
  const projection = build12MonthProjection(
    inputs,
    monthlySurplus,
    debtResult,
    investResult,
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
    homeMonthlyContribution,
    emergencyMonthlyContribution,
    financialHealthScore: health.total,
    healthScoreBreakdown: {
      cashflow: health.cashflow,
      debt: health.debt,
      emergency: health.emergency,
      investing: health.investing,
      tax: health.tax,
    },
    goalWarnings,
    actionChecklist,
  };
}

/**
 * When the Paycheck Calculator store is complete, align hero surplus, savings rate,
 * waterfall, projections, priorities, and invest baseline with Budget / Debt tools
 * (net pay — expenses — bank savings — debt minimums; no double-counting payroll).
 */
export function mergePlanMetricsWithUnifiedBudget(
  base: PlanMetrics,
  paycheckResults: StorePaycheckResults,
  paycheckInputs: StorePaycheckInputs,
  budgetInputs: StoreBudgetInputs,
  debts: Array<{ id?: string; name?: string; balance?: number; apr?: number; minPayment: number }>,
  inputs: PlanInputs,
  debtOverrides: PlanDebtSimulationOverrides = {},
): PlanMetrics {
  if (!paycheckResults.isComplete) {
    return base;
  }

  const monthlyIncome = paycheckResults.netPayMonthly + budgetInputs.investmentIncome;
  const unifiedSurplus = computeBudgetSurplus(paycheckResults, budgetInputs, debts);
  const unifiedSavingsRate = computeSavingsRate(
    paycheckResults,
    paycheckInputs,
    budgetInputs,
  );

  const budgetExpenses = computeTotalExpenses(budgetInputs);
  const optional = computeOptionalMonthlySavings(budgetInputs);
  const debtMins = debts.reduce((s, d) => s + (d.minPayment ?? 0), 0);
  const unifiedDebts: Debt[] = debts
    .filter((d) => (d.balance ?? 0) > 0)
    .map((d, i) => ({
      id: d.id ?? `store-debt-${i}`,
      name: d.name ?? `Debt ${i + 1}`,
      balance: d.balance ?? 0,
      apr: d.apr ?? 0,
      minPayment: d.minPayment,
    }));
  const hasDebts = unifiedDebts.length > 0;
  const totalDebtBalance = unifiedDebts.reduce((s, d) => s + d.balance, 0);
  const debtResult = hasDebts
    ? simulateDebtPayoff(
      unifiedDebts,
      Math.max(0, debtOverrides.monthlyOverpayment ?? 0),
      Math.max(0, debtOverrides.annualBonus ?? 0),
      debtOverrides.bonusMonth ?? 2,
      debtOverrides.strategy ?? 'avalanche',
    )
    : null;
  const debtFreeDate = debtResult?.debtFreeDate ?? null;

  const monthlyInvestCapacity = Math.max(0, unifiedSurplus);

  const investResult =
    monthlyInvestCapacity > 0
      ? simulateInvestment({
          monthlyBuy: monthlyInvestCapacity,
          annualBonus: 0,
          dividendYield: 7,
          taxRate: Math.round(Math.min(paycheckResults.marginalCombinedRate, 0.5) * 100),
          qualifiedPercent: 70,
          payFrequency: 'monthly',
          years: 5,
          annualAppreciation: 3,
        })
      : null;

  const emergencyFundMonthsCovered =
    budgetExpenses > 0 ? inputs.currentEmergencyFund / budgetExpenses : 0;

  let emergencyFundDate: string | null = null;
  const remainingEmergencyTarget = Math.max(0, inputs.emergencyFundTarget - inputs.currentEmergencyFund);
  if (remainingEmergencyTarget > 0 && unifiedSurplus > 0) {
    const monthsNeeded = Math.ceil(remainingEmergencyTarget / unifiedSurplus);
    const target = addMonths(new Date(), monthsNeeded);
    emergencyFundDate = target.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  const partialMetrics: Partial<PlanMetrics> = {
    monthlySurplus: unifiedSurplus,
    debtResult,
    debtFreeDate,
    monthlyInvestCapacity,
    investResult,
    taxEfficiencyScore: base.taxEfficiencyScore,
    taxSuggestions: base.taxSuggestions,
    emergencyFundMonthsCovered,
    homeMonthlyContribution: budgetInputs.homeDownPaymentMonthly,
    emergencyMonthlyContribution: budgetInputs.emergencyFundMonthly,
  };
  const priorities = buildPriorities(inputs, partialMetrics);
  const health = buildHealthScore({
    monthlySurplus: unifiedSurplus,
    monthlyTakeHome: monthlyIncome,
    totalDebtBalance,
    monthlyDebtMinimums: debtMins,
    emergencyFundMonthsCovered,
    monthlyInvestCapacity,
    taxEfficiencyScore: base.taxEfficiencyScore,
  });
  const goalWarnings = buildGoalWarnings(inputs, {
    monthlySurplus: unifiedSurplus,
    emergencyFundMonthsCovered,
    homeMonthlyContribution: budgetInputs.homeDownPaymentMonthly,
    emergencyMonthlyContribution: budgetInputs.emergencyFundMonthly,
    debtResult,
    monthlyInvestCapacity,
  });
  const actionChecklist = buildActionChecklist(inputs, {
    monthlySurplus: unifiedSurplus,
    emergencyMonthlyContribution: budgetInputs.emergencyFundMonthly,
    homeMonthlyContribution: budgetInputs.homeDownPaymentMonthly,
    monthlyInvestCapacity,
    debtResult,
    taxSuggestions: base.taxSuggestions,
    goalWarnings,
  });

  const projection = build12MonthProjection(
    inputs,
    unifiedSurplus,
    debtResult,
    investResult,
  );

  const grossMonthly = paycheckResults.grossAnnual / 12;
  const preTaxMonthly = paycheckResults.totalPreTaxDeductions / 12;
  const taxesMonthly = paycheckResults.totalTaxesAnnual / 12;
  const netPay = paycheckResults.netPayMonthly;

  const waterfallData: WaterfallEntry[] = [
    { name: 'Gross Salary', value: grossMonthly, running: grossMonthly, type: 'income' },
    {
      name: 'Pre-Tax Deductions',
      value: -preTaxMonthly,
      running: grossMonthly - preTaxMonthly,
      type: 'deduction',
    },
    {
      name: 'Taxes',
      value: -taxesMonthly,
      running: netPay,
      type: 'tax',
    },
    { name: 'Net Pay', value: 0, running: netPay, type: 'result' },
  ];

  let flow = netPay;
  if (budgetInputs.investmentIncome > 0) {
    flow += budgetInputs.investmentIncome;
    waterfallData.push({
      name: 'Investment income',
      value: budgetInputs.investmentIncome,
      running: flow,
      type: 'income',
    });
  }

  flow -= budgetExpenses;
  waterfallData.push({
    name: 'Living expenses',
    value: -budgetExpenses,
    running: flow,
    type: 'expense',
  });

  const bankAndDebt = optional + debtMins;
  flow -= bankAndDebt;
  waterfallData.push({
    name: 'Bank savings & debt minimums',
    value: -bankAndDebt,
    running: flow,
    type: 'expense',
  });

  waterfallData.push({
    name: 'Monthly surplus',
    value: 0,
    running: unifiedSurplus,
    type: 'result',
  });

  return {
    ...base,
    monthlyTakeHome: monthlyIncome,
    totalMonthlyExpenses: budgetExpenses,
    monthlySurplus: unifiedSurplus,
    savingsRate: unifiedSavingsRate,
    hasDebts,
    debtResult,
    debtFreeDate,
    totalDebtBalance,
    monthlyDebtMinimums: debtMins,
    monthlyInvestCapacity,
    investResult,
    waterfallData,
    priorities,
    projection,
    emergencyFundMonthsCovered,
    emergencyFundDate,
    homeMonthlyContribution: budgetInputs.homeDownPaymentMonthly,
    emergencyMonthlyContribution: budgetInputs.emergencyFundMonthly,
    financialHealthScore: health.total,
    healthScoreBreakdown: {
      cashflow: health.cashflow,
      debt: health.debt,
      emergency: health.emergency,
      investing: health.investing,
      tax: health.tax,
    },
    goalWarnings,
    actionChecklist,
  };
}
