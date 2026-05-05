import type { UnifiedMonthlyFlow } from '@/lib/calculations';

export interface HousingAffordabilityInputs {
  flow: UnifiedMonthlyFlow;
  currentHousing: number;
  partnerMonthlyIncome: number;
  partnerMonthlyDebt: number;
  targetMonthlySavings: number;
  annualMortgageRate: number;
  loanTermYears: number;
  downPaymentCash: number;
  downPaymentPct: number;
  annualPropertyTaxRate: number;
  annualHomeInsuranceRate: number;
  monthlyHoa: number;
}

export interface HousingAffordabilityResults {
  monthlyIncomeHousehold: number;
  monthlyGrossHousehold: number;
  nonHousingOutflows: number;
  maxByCashflow: number;
  maxByFrontEndRatio: number;
  maxByBackEndRatio: number;
  recommendedMonthlyHousing: number;
  stretchMonthlyHousing: number;
  conservativeMonthlyHousing: number;
  affordableMonthlyRent: number;
  affordableHomePrice: number;
  affordableLoanAmount: number;
  estimatedMonthlyMortgagePI: number;
}

function pmt(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0) return 0;
  if (monthlyRate <= 0) return principal / Math.max(1, months);
  const growth = Math.pow(1 + monthlyRate, months);
  return principal * (monthlyRate * growth) / (growth - 1);
}

function estimatePriceFromHousingBudget(
  housingBudget: number,
  annualRate: number,
  years: number,
  downPaymentPct: number,
  downPaymentCash: number,
  annualPropertyTaxRate: number,
  annualInsuranceRate: number,
  monthlyHoa: number,
): { homePrice: number; loanAmount: number; monthlyPI: number } {
  const safeBudget = Math.max(0, housingBudget - monthlyHoa);
  const pctCarry = (annualPropertyTaxRate + annualInsuranceRate) / 12;
  const monthlyRate = Math.max(0, annualRate) / 12;
  const months = Math.max(1, Math.round(years * 12));

  let low = 0;
  let high = 3_000_000;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const pctDown = mid * Math.max(0, Math.min(0.95, downPaymentPct));
    const effectiveDown = Math.max(pctDown, Math.max(0, downPaymentCash));
    const loan = Math.max(0, mid - effectiveDown);
    const monthlyPI = pmt(loan, monthlyRate, months);
    const totalMonthly = monthlyPI + mid * pctCarry;
    if (totalMonthly > safeBudget) high = mid;
    else low = mid;
  }

  const homePrice = low;
  const pctDown = homePrice * Math.max(0, Math.min(0.95, downPaymentPct));
  const effectiveDown = Math.max(pctDown, Math.max(0, downPaymentCash));
  const loanAmount = Math.max(0, homePrice - effectiveDown);
  const monthlyPI = pmt(loanAmount, monthlyRate, months);
  return { homePrice, loanAmount, monthlyPI };
}

export function computeHousingAffordability(inputs: HousingAffordabilityInputs): HousingAffordabilityResults {
  const partnerIncome = Math.max(0, inputs.partnerMonthlyIncome);
  const partnerDebt = Math.max(0, inputs.partnerMonthlyDebt);
  const desiredSavings = Math.max(0, inputs.targetMonthlySavings);
  const monthlyIncomeHousehold = inputs.flow.monthlyIncome + partnerIncome;
  const monthlyGrossHousehold = inputs.flow.paycheck.grossAnnual / 12 + partnerIncome / 0.72;

  const nonHousingOutflows = Math.max(0, inputs.flow.cashOutflows - inputs.currentHousing) + partnerDebt + desiredSavings;
  const maxByCashflow = Math.max(0, monthlyIncomeHousehold - nonHousingOutflows);
  const maxByFrontEndRatio = Math.max(0, monthlyGrossHousehold * 0.28);
  const maxByBackEndRatio = Math.max(0, monthlyGrossHousehold * 0.36 - (inputs.flow.debtMinimums + partnerDebt));

  const recommendedMonthlyHousing = Math.max(0, Math.min(maxByCashflow, maxByFrontEndRatio, maxByBackEndRatio));
  const stretchMonthlyHousing = Math.max(0, Math.min(maxByCashflow, maxByBackEndRatio));
  const conservativeMonthlyHousing = Math.max(0, Math.min(recommendedMonthlyHousing, monthlyIncomeHousehold * 0.25));
  const affordableMonthlyRent = recommendedMonthlyHousing;

  const { homePrice, loanAmount, monthlyPI } = estimatePriceFromHousingBudget(
    recommendedMonthlyHousing,
    inputs.annualMortgageRate,
    inputs.loanTermYears,
    inputs.downPaymentPct,
    inputs.downPaymentCash,
    inputs.annualPropertyTaxRate,
    inputs.annualHomeInsuranceRate,
    inputs.monthlyHoa,
  );

  return {
    monthlyIncomeHousehold,
    monthlyGrossHousehold,
    nonHousingOutflows,
    maxByCashflow,
    maxByFrontEndRatio,
    maxByBackEndRatio,
    recommendedMonthlyHousing,
    stretchMonthlyHousing,
    conservativeMonthlyHousing,
    affordableMonthlyRent,
    affordableHomePrice: homePrice,
    affordableLoanAmount: loanAmount,
    estimatedMonthlyMortgagePI: monthlyPI,
  };
}
