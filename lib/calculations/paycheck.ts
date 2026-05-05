import { computeStateTax, STATE_BY_ABBR } from '@/lib/stateTax';

export type PayPeriod = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type FilingStatus = 'single' | 'married' | 'hoh';

export interface PaycheckInputs {
  annualSalary: number;
  payPeriod: PayPeriod;
  filingStatus: FilingStatus;
  state: string; // state abbreviation, e.g. 'MA'
  nycResident: boolean;
  // Pre-tax deductions (per pay period)
  traditional401kPct: number; // %
  hsaPerPeriod: number; // $
  fsaPerPeriod: number; // $
  healthInsurancePerPeriod: number; // $
  dentalPerPeriod: number; // $
  commuterBenefitPerPeriod: number; // $
  // Post-tax
  roth401kPct: number; // %
  otherPostTaxPerPeriod: number; // $
}

export interface AdditionalPayrollTax {
  name: string;
  amount: number; // per period
}

export interface PaycheckResult {
  grossPay: number;
  traditional401k: number;
  hsa: number;
  fsa: number;
  healthInsurance: number;
  dental: number;
  commuterBenefit: number;
  totalPreTax: number;
  federalTaxableWages: number;
  ficaWages: number;
  federalIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  stateTax: number;
  localTax: number;
  additionalPayrollTaxes: AdditionalPayrollTax[];
  totalTaxes: number;
  roth401k: number;
  otherPostTax: number;
  totalPostTax: number;
  netPay: number;
  effectiveFederalRate: number;
  marginalFederalRate: number;
  stateEffectiveRate: number;
  benefitSavings: {
    traditional401k: number;
    hsa: number;
    fsa: number;
    healthInsurance: number;
    dental: number;
    commuterBenefit: number;
  };
}

export const PAY_PERIODS: Record<PayPeriod, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

// 2025 Federal tax brackets
const BRACKETS: Record<FilingStatus, Array<[number, number]>> = {
  single: [
    [11925, 0.10], [48475, 0.12], [103350, 0.22],
    [197300, 0.24], [250525, 0.32], [626350, 0.35], [Infinity, 0.37],
  ],
  married: [
    [23850, 0.10], [96950, 0.12], [206700, 0.22],
    [394600, 0.24], [501050, 0.32], [751600, 0.35], [Infinity, 0.37],
  ],
  hoh: [
    [17000, 0.10], [64850, 0.12], [103350, 0.22],
    [197300, 0.24], [250500, 0.32], [626350, 0.35], [Infinity, 0.37],
  ],
};

const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = {
  single: 15000, married: 30000, hoh: 22500,
};

const SS_WAGE_BASE = 176100;

function federalTax(income: number, status: FilingStatus): number {
  if (income <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const [upper, rate] of BRACKETS[status]) {
    if (income <= prev) break;
    tax += (Math.min(income, upper) - prev) * rate;
    prev = upper;
  }
  return tax;
}

function marginalRate(income: number, status: FilingStatus): number {
  if (income <= 0) return 0.10;
  for (const [upper, rate] of BRACKETS[status]) {
    if (income <= upper) return rate;
  }
  return 0.37;
}

export function calculatePaycheck(inp: PaycheckInputs): PaycheckResult {
  const periods = PAY_PERIODS[inp.payPeriod];
  const gross = inp.annualSalary / periods;

  // Pre-tax deductions per period
  const trad401k = gross * (inp.traditional401kPct / 100);
  const sec125 = inp.hsaPerPeriod + inp.fsaPerPeriod +
    inp.healthInsurancePerPeriod + inp.dentalPerPeriod +
    inp.commuterBenefitPerPeriod;
  const totalPreTax = trad401k + sec125;

  const annualTrad401k = trad401k * periods;
  const annualSec125 = sec125 * periods;

  // Federal taxable income (annual)
  const annualFedTaxable = Math.max(0,
    inp.annualSalary - annualTrad401k - annualSec125 - STANDARD_DEDUCTIONS[inp.filingStatus]
  );
  const annualFedTax = federalTax(annualFedTaxable, inp.filingStatus);
  const fedTaxPerPeriod = annualFedTax / periods;
  const marginal = marginalRate(annualFedTaxable, inp.filingStatus);
  const effectiveRate = inp.annualSalary > 0 ? annualFedTax / inp.annualSalary : 0;

  // FICA wages (401k does NOT reduce FICA; Section 125 does)
  const ficaPerPeriod = gross - sec125;
  const annualFica = ficaPerPeriod * periods;

  const ssPerPeriod = (Math.min(annualFica, SS_WAGE_BASE) * 0.062) / periods;
  const medicareBase = ficaPerPeriod * 0.0145;
  const medicareSurtax = Math.max(0, annualFica - 200000) * 0.009 / periods;
  const medicarePerPeriod = medicareBase + medicareSurtax;

  // State taxes using 50-state engine
  const stateConfig = STATE_BY_ABBR[inp.state] ?? STATE_BY_ABBR['CA'];
  const stateResult = computeStateTax(
    stateConfig,
    inp.annualSalary,
    annualTrad401k,
    annualSec125,
    inp.filingStatus,
    inp.state === 'NY' && inp.nycResident,
  );
  const stateTaxPerPeriod = stateResult.incomeTax / periods;
  const localTaxPerPeriod = stateResult.localTax / periods;
  const additionalPayrollTaxes: AdditionalPayrollTax[] = stateResult.additionalTaxes.map((t) => ({
    name: t.name,
    amount: t.amount / periods,
  }));

  const additionalTotal = additionalPayrollTaxes.reduce((s, t) => s + t.amount, 0);
  const totalTaxes = fedTaxPerPeriod + ssPerPeriod + medicarePerPeriod +
    stateTaxPerPeriod + localTaxPerPeriod + additionalTotal;

  // Post-tax
  const roth401k = gross * (inp.roth401kPct / 100);
  const totalPostTax = roth401k + inp.otherPostTaxPerPeriod;

  const netPay = gross - totalPreTax - totalTaxes - totalPostTax;

  // Benefit tax savings
  const ficaRate = 0.062 + 0.0145;
  const stateRate = inp.annualSalary > 0 ? stateResult.incomeTax / inp.annualSalary : 0;
  const incomeRate = marginal + stateRate;
  const section125Rate = incomeRate + ficaRate;

  const stateEffectiveRate = inp.annualSalary > 0
    ? (stateResult.incomeTax + stateResult.localTax) / inp.annualSalary
    : 0;

  return {
    grossPay: gross,
    traditional401k: trad401k,
    hsa: inp.hsaPerPeriod,
    fsa: inp.fsaPerPeriod,
    healthInsurance: inp.healthInsurancePerPeriod,
    dental: inp.dentalPerPeriod,
    commuterBenefit: inp.commuterBenefitPerPeriod,
    totalPreTax,
    federalTaxableWages: gross - totalPreTax,
    ficaWages: ficaPerPeriod,
    federalIncomeTax: fedTaxPerPeriod,
    socialSecurity: ssPerPeriod,
    medicare: medicarePerPeriod,
    stateTax: stateTaxPerPeriod,
    localTax: localTaxPerPeriod,
    additionalPayrollTaxes,
    totalTaxes,
    roth401k,
    otherPostTax: inp.otherPostTaxPerPeriod,
    totalPostTax,
    netPay,
    effectiveFederalRate: effectiveRate,
    marginalFederalRate: marginal,
    stateEffectiveRate,
    benefitSavings: {
      traditional401k: annualTrad401k * incomeRate,
      hsa: inp.hsaPerPeriod * periods * section125Rate,
      fsa: inp.fsaPerPeriod * periods * section125Rate,
      healthInsurance: inp.healthInsurancePerPeriod * periods * section125Rate,
      dental: inp.dentalPerPeriod * periods * section125Rate,
      commuterBenefit: inp.commuterBenefitPerPeriod * periods * section125Rate,
    },
  };
}
