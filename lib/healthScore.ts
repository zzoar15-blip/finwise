import type { StoreBudgetInputs, StorePaycheckInputs, StorePaycheckResults } from '@/lib/calculations';
import { computeTotalExpenses } from '@/lib/calculations';
import type { Debt } from '@/lib/calculations/debt';
import type { BonusProfile } from '@/lib/bonusProfile';

export interface ScoreBreakdown {
  cashflow: {
    score: number;
    weight: number;
    weightedScore: number;
    surplusRate: number;
    monthlySurplus: number;
    monthlyIncome: number;
  };
  debt: {
    score: number;
    weight: number;
    weightedScore: number;
    totalDebt: number;
    dti: number;
    hasDebt: boolean;
  };
  emergencyFund: {
    score: number;
    weight: number;
    weightedScore: number;
    currentBalance: number;
    monthlyExpenses: number;
    monthsCovered: number;
    target3Months: number;
    target6Months: number;
  };
  savingsRate: {
    score: number;
    weight: number;
    weightedScore: number;
    currentRate: number;
    totalMonthlySavings: number;
    monthlyIncome: number;
  };
  taxEfficiency: {
    score: number;
    weight: number;
    weightedScore: number;
    hsaMaxed: boolean;
    k401Contributing: boolean;
    k401Maxed: boolean;
    fsaContributing: boolean;
    commuterBenefit: boolean;
    annualOpportunity: number;
  };
  overall: number;
}

export interface ComputeHealthScoreOptions {
  /** Extra going to debt beyond minimums — reduces modeled surplus for cashflow only */
  monthlyDebtExtra?: number;
  /** Optional modeled debt balance for DTI (after accelerated paydown). Defaults to sum(debts.balance). */
  modeledTotalDebt?: number;
}

const W_CASH = 0.3;
const W_DEBT = 0.25;
const W_EF = 0.2;
const W_SAVE = 0.15;
const W_TAX = 0.1;

export function computeHealthScore(
  paycheckResults: StorePaycheckResults,
  paycheckInputs: StorePaycheckInputs,
  budgetInputs: StoreBudgetInputs,
  debts: Debt[],
  _bonusProfile: BonusProfile,
  opts?: ComputeHealthScoreOptions,
): ScoreBreakdown {
  void _bonusProfile;
  const monthlyIncome =
    paycheckResults.netPayMonthly + (budgetInputs.investmentIncome ?? 0);
  const monthlyExpenses = computeTotalExpenses(budgetInputs);
  const extraDebt = Math.max(0, opts?.monthlyDebtExtra ?? 0);
  const monthlySurplus = monthlyIncome - monthlyExpenses - extraDebt;
  const surplusRate = monthlyIncome > 0 ? monthlySurplus / monthlyIncome : 0;

  const cashflowScore =
    surplusRate >= 0.2 ? 100 :
    surplusRate >= 0.1 ? 75 :
    surplusRate >= 0.05 ? 50 :
    surplusRate > 0 ? 25 : 0;

  const totalDebt =
    opts?.modeledTotalDebt ??
    debts.reduce((s, d) => s + Math.max(0, d.balance), 0);
  const annualIncome = monthlyIncome * 12;
  const dti = annualIncome > 0 ? totalDebt / annualIncome : 0;
  const debtScore =
    totalDebt === 0 ? 100 :
    dti < 0.1 ? 75 :
    dti < 0.2 ? 50 :
    dti < 0.35 ? 25 : 0;

  const currentBalance = budgetInputs.emergencyFundBalance ?? 0;
  const monthsCovered =
    monthlyExpenses > 0 ? currentBalance / monthlyExpenses : 0;
  const emergencyScore =
    monthsCovered >= 6 ? 100 :
    monthsCovered >= 3 ? 75 :
    monthsCovered >= 1 ? 50 :
    monthsCovered > 0 ? 25 : 0;

  const totalMonthlySavings =
    paycheckResults.k401TraditionalAnnual / 12 +
    paycheckResults.k401RothAnnual / 12 +
    paycheckInputs.hsaAnnual / 12 +
    (budgetInputs.rothIraMonthly ?? 0) +
    (budgetInputs.brokerageMonthly ?? 0) +
    (budgetInputs.emergencyFundMonthly ?? 0);
  const savingsRate =
    monthlyIncome > 0 ? totalMonthlySavings / monthlyIncome : 0;
  const savingsScore =
    savingsRate >= 0.2 ? 100 :
    savingsRate >= 0.15 ? 75 :
    savingsRate >= 0.1 ? 50 :
    savingsRate >= 0.05 ? 25 : 0;

  const hsaLimit = 4300;
  const k401Limit = 23500;
  const hsaContrib = paycheckInputs.hsaAnnual ?? 0;
  const k401Contrib = paycheckResults.k401TraditionalAnnual ?? 0;
  const fsaContrib = paycheckInputs.fsaAnnual ?? 0;
  const commuterContrib = paycheckInputs.commuterAnnual ?? 0;

  let taxScore = 0;
  if (hsaContrib >= hsaLimit) taxScore += 35;
  else if (hsaContrib > 0) taxScore += 15;
  if (k401Contrib >= k401Limit) taxScore += 40;
  else if (k401Contrib > 0) taxScore += 20;
  if (fsaContrib > 0) taxScore += 15;
  if (commuterContrib > 0) taxScore += 10;
  taxScore = Math.min(100, taxScore);

  const marginalRate = paycheckResults.marginalCombinedRate ?? 0.28;
  const ficaRate = 0.0765;
  const hsaOpportunity = Math.max(0, hsaLimit - hsaContrib) * (marginalRate + ficaRate);
  const k401Opportunity = Math.max(0, k401Limit - k401Contrib) * marginalRate;
  const fsaOpportunity = fsaContrib === 0 ? 3300 * marginalRate : 0;
  const annualOpportunity = hsaOpportunity + k401Opportunity + fsaOpportunity;

  const overall =
    cashflowScore * W_CASH +
    debtScore * W_DEBT +
    emergencyScore * W_EF +
    savingsScore * W_SAVE +
    taxScore * W_TAX;

  return {
    cashflow: {
      score: cashflowScore,
      weight: W_CASH,
      weightedScore: cashflowScore * W_CASH,
      surplusRate,
      monthlySurplus,
      monthlyIncome,
    },
    debt: {
      score: debtScore,
      weight: W_DEBT,
      weightedScore: debtScore * W_DEBT,
      totalDebt,
      dti,
      hasDebt: totalDebt > 0,
    },
    emergencyFund: {
      score: emergencyScore,
      weight: W_EF,
      weightedScore: emergencyScore * W_EF,
      currentBalance,
      monthlyExpenses,
      monthsCovered,
      target3Months: monthlyExpenses * 3,
      target6Months: monthlyExpenses * 6,
    },
    savingsRate: {
      score: savingsScore,
      weight: W_SAVE,
      weightedScore: savingsScore * W_SAVE,
      currentRate: savingsRate,
      totalMonthlySavings,
      monthlyIncome,
    },
    taxEfficiency: {
      score: taxScore,
      weight: W_TAX,
      weightedScore: taxScore * W_TAX,
      hsaMaxed: hsaContrib >= hsaLimit,
      k401Contributing: k401Contrib > 0,
      k401Maxed: k401Contrib >= k401Limit,
      fsaContributing: fsaContrib > 0,
      commuterBenefit: commuterContrib > 0,
      annualOpportunity,
    },
    overall: Math.round(overall),
  };
}
