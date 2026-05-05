// lib/calculations.ts
import { calculatePaycheck, PAY_PERIODS } from '@/lib/calculations/paycheck';
import type { PayPeriod, FilingStatus } from '@/lib/calculations/paycheck';

export interface StorePaycheckInputs {
  annualSalary: number;
  state: string;
  filingStatus: FilingStatus;
  payPeriod: PayPeriod;
  k401TraditionalPct: number;
  k401RothPct: number;
  hsaAnnual: number;
  fsaAnnual: number;
  healthInsuranceAnnual: number;
  dentalAnnual: number;
  visionAnnual: number;
  commuterAnnual: number;
  otherPreTaxAnnual: number;
  otherPostTaxAnnual: number;
  additionalWithholding: number;
  nycResident: boolean;
}

export interface StorePaycheckResults {
  grossPerPaycheck: number;
  grossAnnual: number;
  totalPreTaxDeductions: number;
  federalTaxAnnual: number;
  stateTaxAnnual: number;
  ssAnnual: number;
  medicareAnnual: number;
  statePfmlAnnual: number;
  totalTaxesAnnual: number;
  k401TraditionalAnnual: number;
  k401RothAnnual: number;
  netPayPerPaycheck: number;
  netPayMonthly: number;
  netPayAnnual: number;
  effectiveTaxRate: number;
  marginalFederalRate: number;
  marginalCombinedRate: number;
  annualTaxSavingsFromBenefits: number;
  isComplete: boolean;
}

export interface StoreBudgetInputs {
  investmentIncome: number;
  housing: number;
  utilities: number;
  insurance: number;
  groceries: number;
  dining: number;
  transportation: number;
  subscriptions: number;
  phone: number;
  healthGym: number;
  travel: number;
  misc: number;
  brokerageMonthly: number;
  rothIraMonthly: number;
  emergencyFundMonthly: number;
}

export interface StoreInvestmentInputs {
  monthlyBuy: number;
  annualBonus: number;
  dividendYield: number;
  taxRate: number;
  qualifiedPercent: number;
  payFrequency: 'monthly' | 'quarterly';
  years: number;
  annualAppreciation: number;
}

export const DEFAULT_PAYCHECK_INPUTS: StorePaycheckInputs = {
  annualSalary: 0, state: 'CA', filingStatus: 'single', payPeriod: 'biweekly',
  k401TraditionalPct: 0, k401RothPct: 0, hsaAnnual: 0, fsaAnnual: 0,
  healthInsuranceAnnual: 0, dentalAnnual: 0, visionAnnual: 0, commuterAnnual: 0,
  otherPreTaxAnnual: 0, otherPostTaxAnnual: 0, additionalWithholding: 0, nycResident: false,
};

export const DEFAULT_PAYCHECK_RESULTS: StorePaycheckResults = {
  grossPerPaycheck: 0, grossAnnual: 0, totalPreTaxDeductions: 0, federalTaxAnnual: 0,
  stateTaxAnnual: 0, ssAnnual: 0, medicareAnnual: 0, statePfmlAnnual: 0, totalTaxesAnnual: 0,
  k401TraditionalAnnual: 0, k401RothAnnual: 0, netPayPerPaycheck: 0, netPayMonthly: 0,
  netPayAnnual: 0, effectiveTaxRate: 0, marginalFederalRate: 0, marginalCombinedRate: 0,
  annualTaxSavingsFromBenefits: 0, isComplete: false,
};

export const DEFAULT_BUDGET_INPUTS: StoreBudgetInputs = {
  investmentIncome: 0, housing: 0, utilities: 0, insurance: 0, groceries: 0, dining: 0,
  transportation: 0, subscriptions: 0, phone: 0, healthGym: 0, travel: 0, misc: 0,
  brokerageMonthly: 0, rothIraMonthly: 0, emergencyFundMonthly: 0,
};

export const DEFAULT_INVESTMENT_INPUTS: StoreInvestmentInputs = {
  monthlyBuy: 500, annualBonus: 0, dividendYield: 7, taxRate: 22,
  qualifiedPercent: 70, payFrequency: 'monthly', years: 5, annualAppreciation: 3,
};

export function computePaycheck(inputs: StorePaycheckInputs): StorePaycheckResults {
  if (inputs.annualSalary <= 0) return { ...DEFAULT_PAYCHECK_RESULTS };
  const periods = PAY_PERIODS[inputs.payPeriod] || 1;
  const result = calculatePaycheck({
    annualSalary: inputs.annualSalary,
    payPeriod: inputs.payPeriod,
    filingStatus: inputs.filingStatus,
    state: inputs.state,
    nycResident: inputs.nycResident,
    traditional401kPct: inputs.k401TraditionalPct,
    roth401kPct: inputs.k401RothPct,
    hsaPerPeriod: inputs.hsaAnnual / periods,
    fsaPerPeriod: inputs.fsaAnnual / periods,
    healthInsurancePerPeriod: inputs.healthInsuranceAnnual / periods,
    dentalPerPeriod: (inputs.dentalAnnual + inputs.visionAnnual) / periods,
    commuterBenefitPerPeriod: inputs.commuterAnnual / periods,
    otherPostTaxPerPeriod: inputs.otherPostTaxAnnual / periods,
  });
  const marginalCombined = result.marginalFederalRate + result.stateEffectiveRate + 0.0765;
  const pretaxTotal = result.totalPreTax * periods;
  const taxSavings = pretaxTotal * (result.marginalFederalRate + result.stateEffectiveRate) +
    (inputs.hsaAnnual + inputs.fsaAnnual + inputs.commuterAnnual) * 0.0765;
  const pfml = result.additionalPayrollTaxes.reduce((s, t) => s + t.amount, 0);
  return {
    grossPerPaycheck: result.grossPay,
    grossAnnual: result.grossPay * periods,
    totalPreTaxDeductions: pretaxTotal,
    federalTaxAnnual: result.federalIncomeTax * periods,
    stateTaxAnnual: result.stateTax * periods,
    ssAnnual: result.socialSecurity * periods,
    medicareAnnual: result.medicare * periods,
    statePfmlAnnual: pfml * periods,
    totalTaxesAnnual: result.totalTaxes * periods,
    k401TraditionalAnnual: result.traditional401k * periods,
    k401RothAnnual: result.roth401k * periods,
    netPayPerPaycheck: result.netPay,
    netPayMonthly: (result.netPay * periods) / 12,
    netPayAnnual: result.netPay * periods,
    effectiveTaxRate: result.effectiveFederalRate + result.stateEffectiveRate,
    marginalFederalRate: result.marginalFederalRate,
    marginalCombinedRate: Math.min(marginalCombined, 0.65),
    annualTaxSavingsFromBenefits: Math.max(0, taxSavings),
    isComplete: true,
  };
}

export function computeTotalExpenses(budget: StoreBudgetInputs): number {
  return budget.housing + budget.utilities + budget.insurance + budget.groceries +
    budget.dining + budget.transportation + budget.subscriptions + budget.phone +
    budget.healthGym + budget.travel + budget.misc;
}

export function computeTotalSavings(paycheckResults: StorePaycheckResults, paycheckInputs: StorePaycheckInputs, budget: StoreBudgetInputs): number {
  return paycheckResults.k401TraditionalAnnual / 12 + paycheckResults.k401RothAnnual / 12 +
    paycheckInputs.hsaAnnual / 12 + paycheckInputs.fsaAnnual / 12 +
    budget.brokerageMonthly + budget.rothIraMonthly + budget.emergencyFundMonthly;
}

export function computeBudgetSurplus(results: StorePaycheckResults, budget: StoreBudgetInputs): number {
  const income = results.netPayMonthly + budget.investmentIncome;
  const expenses = computeTotalExpenses(budget);
  return income - expenses;
}

export function computeSavingsRate(results: StorePaycheckResults, budget: StoreBudgetInputs): number {
  const income = results.netPayMonthly + budget.investmentIncome;
  if (income <= 0) return 0;
  const savings = budget.brokerageMonthly + budget.rothIraMonthly + budget.emergencyFundMonthly;
  return (savings / income) * 100;
}

export function buildFinancialContext(
  paycheckInputs: StorePaycheckInputs,
  paycheckResults: StorePaycheckResults,
  budgetInputs: StoreBudgetInputs,
  debts: Array<{ name: string; balance: number; apr: number; minPayment: number }>,
  investmentInputs: StoreInvestmentInputs,
  goals: string[],
): string {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const surplus = computeBudgetSurplus(paycheckResults, budgetInputs);
  const expenses = computeTotalExpenses(budgetInputs);
  const savingsRate = computeSavingsRate(paycheckResults, budgetInputs);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const lines: string[] = [];
  if (paycheckResults.isComplete) {
    lines.push(`Annual salary: ${fmt(paycheckInputs.annualSalary)}`);
    lines.push(`State: ${paycheckInputs.state}, Filing: ${paycheckInputs.filingStatus}`);
    lines.push(`Gross per paycheck: ${fmt(paycheckResults.grossPerPaycheck)}`);
    lines.push(`Net monthly take-home: ${fmt(paycheckResults.netPayMonthly)}`);
    lines.push(`Effective tax rate: ${pct(paycheckResults.effectiveTaxRate)}`);
    lines.push(`Marginal federal rate: ${pct(paycheckResults.marginalFederalRate)}`);
    lines.push(`Annual tax savings from benefits: ${fmt(paycheckResults.annualTaxSavingsFromBenefits)}`);
    lines.push(`401(k) traditional: ${fmt(paycheckResults.k401TraditionalAnnual)}/yr`);
    if (paycheckInputs.hsaAnnual > 0) lines.push(`HSA: ${fmt(paycheckInputs.hsaAnnual)}/yr`);
    if (paycheckInputs.fsaAnnual > 0) lines.push(`FSA: ${fmt(paycheckInputs.fsaAnnual)}/yr`);
  }
  if (expenses > 0) {
    lines.push(`Monthly expenses: ${fmt(expenses)}`);
    lines.push(`Monthly surplus: ${fmt(surplus)}`);
    lines.push(`Savings rate: ${savingsRate.toFixed(1)}%`);
  }
  if (debts.length > 0) {
    lines.push(`Total debt: ${fmt(totalDebt)}`);
    debts.forEach(d => lines.push(`  ${d.name}: ${fmt(d.balance)} @ ${d.apr}% APR, min ${fmt(d.minPayment)}/mo`));
  }
  if (investmentInputs.monthlyBuy > 0) {
    lines.push(`Monthly investment: ${fmt(investmentInputs.monthlyBuy)}`);
    lines.push(`Investment yield: ${investmentInputs.dividendYield}%`);
  }
  if (goals.length > 0) lines.push(`Goals: ${goals.join(', ')}`);
  return lines.join('\n') || 'No financial data entered yet.';
}
