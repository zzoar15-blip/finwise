export type PayPeriod = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type FilingStatus = 'single' | 'married' | 'hoh';

export interface PaycheckInputs {
  annualSalary: number;
  payPeriod: PayPeriod;
  filingStatus: FilingStatus;
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
  maStateTax: number;
  maPfml: number;
  totalTaxes: number;
  roth401k: number;
  otherPostTax: number;
  totalPostTax: number;
  netPay: number;
  effectiveFederalRate: number;
  marginalFederalRate: number;
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

// 2025 Federal tax brackets — cumulative upper limits
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

const MA_EXEMPTIONS: Record<FilingStatus, number> = {
  single: 4400, married: 8800, hoh: 6800,
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
  let prev = 0;
  for (const [upper, rate] of BRACKETS[status]) {
    if (income <= upper) return rate;
    prev = upper;
  }
  return 0.37;
}

export function calculatePaycheck(inp: PaycheckInputs): PaycheckResult {
  const periods = PAY_PERIODS[inp.payPeriod];
  const gross = inp.annualSalary / periods;

  // Pre-tax deductions per period
  const trad401k = gross * (inp.traditional401kPct / 100);
  // Section 125 (reduces FICA + federal + MA)
  const sec125 = inp.hsaPerPeriod + inp.fsaPerPeriod +
    inp.healthInsurancePerPeriod + inp.dentalPerPeriod +
    inp.commuterBenefitPerPeriod;
  const totalPreTax = trad401k + sec125;

  // Federal taxable income (annual)
  const annualFedTaxable = Math.max(0,
    inp.annualSalary - trad401k * periods - sec125 * periods - STANDARD_DEDUCTIONS[inp.filingStatus]
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

  // Massachusetts income tax
  const annualMaTaxable = Math.max(0,
    inp.annualSalary - trad401k * periods - sec125 * periods - MA_EXEMPTIONS[inp.filingStatus]
  );
  const maPerPeriod = (annualMaTaxable * 0.05) / periods;

  // MA PFML: 0.46% on wages up to SS wage base
  const maPfmlPerPeriod = (Math.min(annualFica, SS_WAGE_BASE) * 0.0046) / periods;

  const totalTaxes = fedTaxPerPeriod + ssPerPeriod + medicarePerPeriod + maPerPeriod + maPfmlPerPeriod;

  // Post-tax
  const roth401k = gross * (inp.roth401kPct / 100);
  const totalPostTax = roth401k + inp.otherPostTaxPerPeriod;

  const netPay = gross - totalPreTax - totalTaxes - totalPostTax;

  // Annual benefit tax savings (federal + state + FICA where applicable)
  const ficaRate = 0.062 + 0.0145; // SS + Medicare
  const incomeRate = marginal + 0.05; // federal marginal + MA flat
  const section125Rate = incomeRate + ficaRate; // Section 125 saves income AND FICA

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
    maStateTax: maPerPeriod,
    maPfml: maPfmlPerPeriod,
    totalTaxes,
    roth401k,
    otherPostTax: inp.otherPostTaxPerPeriod,
    totalPostTax,
    netPay,
    effectiveFederalRate: effectiveRate,
    marginalFederalRate: marginal,
    benefitSavings: {
      traditional401k: trad401k * periods * incomeRate,
      hsa: inp.hsaPerPeriod * periods * section125Rate,
      fsa: inp.fsaPerPeriod * periods * section125Rate,
      healthInsurance: inp.healthInsurancePerPeriod * periods * section125Rate,
      dental: inp.dentalPerPeriod * periods * section125Rate,
      commuterBenefit: inp.commuterBenefitPerPeriod * periods * section125Rate,
    },
  };
}
