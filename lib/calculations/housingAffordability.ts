import type { UnifiedMonthlyFlow } from '@/lib/calculations';

export interface HousingAffordabilityInputs {
  flow: UnifiedMonthlyFlow;
  currentHousing: number;
  partnerMonthlyIncome: number;
  partnerMonthlyGrossIncome?: number;
  partnerMonthlyDebt: number;
  targetMonthlySavings: number;
  annualMortgageRate: number;
  loanTermYears: number;
  downPaymentCash: number;
  downPaymentPct: number;
  annualPropertyTaxRate: number;
  annualHomeInsuranceRate: number;
  annualMaintenanceRate?: number;
  monthlyHoa: number;
  pmiRateAnnual?: number;
  closingCostPct?: number;
  frontEndDtiLimit?: number;
  backEndDtiLimit?: number;
  housingPaymentSafetyBufferPct?: number;
}

export interface HousingAffordabilityResults {
  monthlyIncomeHousehold: number;
  monthlyGrossHousehold: number;
  nonHousingOutflows: number;
  availableForHousingAfterBuffer: number;
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
  estimatedMonthlyTax: number;
  estimatedMonthlyInsurance: number;
  estimatedMonthlyMaintenance: number;
  estimatedMonthlyPmi: number;
  estimatedMonthlyAllInOwnership: number;
  estimatedCashToClose: number;
  maxPriceByCashToClose: number;
  bindingConstraint: 'cashflow' | 'front-end-dti' | 'back-end-dti';
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
  availableCashToClose: number,
  annualPropertyTaxRate: number,
  annualInsuranceRate: number,
  annualMaintenanceRate: number,
  monthlyHoa: number,
  pmiRateAnnual: number,
  closingCostPct: number,
): {
  homePrice: number;
  loanAmount: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyMaintenance: number;
  monthlyPmi: number;
  monthlyAllInOwnership: number;
  requiredCashToClose: number;
  maxPriceByCashToClose: number;
} {
  const safeBudget = Math.max(0, housingBudget - monthlyHoa);
  const monthlyRate = Math.max(0, annualRate) / 12;
  const months = Math.max(1, Math.round(years * 12));
  const safeDownPct = Math.max(0, Math.min(0.95, downPaymentPct));
  const safeCash = Math.max(0, availableCashToClose);
  const cashToClosePct = safeDownPct + Math.max(0, closingCostPct);
  const maxPriceByCashToClose = cashToClosePct > 0 ? safeCash / cashToClosePct : 3_000_000;

  const monthlyOwnershipCost = (price: number) => {
    const downPayment = price * safeDownPct;
    const loan = Math.max(0, price - downPayment);
    const monthlyPI = pmt(loan, monthlyRate, months);
    const monthlyTax = (price * Math.max(0, annualPropertyTaxRate)) / 12;
    const monthlyInsurance = (price * Math.max(0, annualInsuranceRate)) / 12;
    const monthlyMaintenance = (price * Math.max(0, annualMaintenanceRate)) / 12;
    const ltv = price > 0 ? loan / price : 0;
    const monthlyPmi =
      ltv > 0.8 ? (loan * Math.max(0, pmiRateAnnual)) / 12 : 0;
    const monthlyAllInOwnership =
      monthlyPI +
      monthlyTax +
      monthlyInsurance +
      monthlyMaintenance +
      monthlyPmi;
    return {
      loan,
      monthlyPI,
      monthlyTax,
      monthlyInsurance,
      monthlyMaintenance,
      monthlyPmi,
      monthlyAllInOwnership,
    };
  };

  let low = 0;
  let high = Math.min(3_000_000, Math.max(0, maxPriceByCashToClose));
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const estimate = monthlyOwnershipCost(mid);
    if (estimate.monthlyAllInOwnership > safeBudget) high = mid;
    else low = mid;
  }

  const homePrice = low;
  const estimate = monthlyOwnershipCost(homePrice);
  const requiredCashToClose = homePrice * cashToClosePct;
  return {
    homePrice,
    loanAmount: estimate.loan,
    monthlyPI: estimate.monthlyPI,
    monthlyTax: estimate.monthlyTax,
    monthlyInsurance: estimate.monthlyInsurance,
    monthlyMaintenance: estimate.monthlyMaintenance,
    monthlyPmi: estimate.monthlyPmi,
    monthlyAllInOwnership: estimate.monthlyAllInOwnership + Math.max(0, monthlyHoa),
    requiredCashToClose,
    maxPriceByCashToClose,
  };
}

export function computeHousingAffordability(inputs: HousingAffordabilityInputs): HousingAffordabilityResults {
  const partnerIncome = Math.max(0, inputs.partnerMonthlyIncome);
  const partnerGross = Math.max(0, inputs.partnerMonthlyGrossIncome ?? partnerIncome / 0.72);
  const partnerDebt = Math.max(0, inputs.partnerMonthlyDebt);
  const desiredSavings = Math.max(0, inputs.targetMonthlySavings);
  const maintenanceRate = Math.max(0, inputs.annualMaintenanceRate ?? 0.01);
  const pmiRateAnnual = Math.max(0, inputs.pmiRateAnnual ?? 0.008);
  const closingCostPct = Math.max(0, inputs.closingCostPct ?? 0.03);
  const frontEndDti = Math.max(0.1, Math.min(0.5, inputs.frontEndDtiLimit ?? 0.28));
  const backEndDti = Math.max(frontEndDti, Math.min(0.65, inputs.backEndDtiLimit ?? 0.36));
  const safetyBufferPct = Math.max(0, Math.min(0.25, inputs.housingPaymentSafetyBufferPct ?? 0.05));
  const monthlyIncomeHousehold = inputs.flow.monthlyIncome + partnerIncome;
  const monthlyGrossHousehold = inputs.flow.paycheck.grossAnnual / 12 + partnerGross;

  const nonHousingOutflows = Math.max(0, inputs.flow.cashOutflows - inputs.currentHousing) + partnerDebt + desiredSavings;
  const maxByCashflowRaw = Math.max(0, monthlyIncomeHousehold - nonHousingOutflows);
  const availableForHousingAfterBuffer = Math.max(0, maxByCashflowRaw * (1 - safetyBufferPct));
  const maxByCashflow = availableForHousingAfterBuffer;
  const maxByFrontEndRatio = Math.max(0, monthlyGrossHousehold * frontEndDti);
  const maxByBackEndRatio = Math.max(0, monthlyGrossHousehold * backEndDti - (inputs.flow.debtMinimums + partnerDebt));

  const recommendedMonthlyHousing = Math.max(0, Math.min(maxByCashflow, maxByFrontEndRatio, maxByBackEndRatio));
  const stretchMonthlyHousing = Math.max(0, Math.min(maxByCashflow, maxByBackEndRatio));
  const conservativeMonthlyHousing = Math.max(0, Math.min(recommendedMonthlyHousing, monthlyIncomeHousehold * 0.25));
  const affordableMonthlyRent = recommendedMonthlyHousing;
  const bindingConstraint = (
    recommendedMonthlyHousing === maxByCashflow
      ? 'cashflow'
      : recommendedMonthlyHousing === maxByFrontEndRatio
        ? 'front-end-dti'
        : 'back-end-dti'
  );

  const {
    homePrice,
    loanAmount,
    monthlyPI,
    monthlyTax,
    monthlyInsurance,
    monthlyMaintenance,
    monthlyPmi,
    monthlyAllInOwnership,
    requiredCashToClose,
    maxPriceByCashToClose,
  } = estimatePriceFromHousingBudget(
    recommendedMonthlyHousing,
    inputs.annualMortgageRate,
    inputs.loanTermYears,
    inputs.downPaymentPct,
    inputs.downPaymentCash,
    inputs.annualPropertyTaxRate,
    inputs.annualHomeInsuranceRate,
    maintenanceRate,
    inputs.monthlyHoa,
    pmiRateAnnual,
    closingCostPct,
  );

  return {
    monthlyIncomeHousehold,
    monthlyGrossHousehold,
    nonHousingOutflows,
    availableForHousingAfterBuffer,
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
    estimatedMonthlyTax: monthlyTax,
    estimatedMonthlyInsurance: monthlyInsurance,
    estimatedMonthlyMaintenance: monthlyMaintenance,
    estimatedMonthlyPmi: monthlyPmi,
    estimatedMonthlyAllInOwnership: monthlyAllInOwnership,
    estimatedCashToClose: requiredCashToClose,
    maxPriceByCashToClose,
    bindingConstraint,
  };
}
