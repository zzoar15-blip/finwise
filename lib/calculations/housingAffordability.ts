import type { UnifiedMonthlyFlow } from '@/lib/calculations';
import { binarySearchMax, clamp, pmt, toMonthlyRate } from '@/lib/calculations/shared';

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

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
  const monthlyRate = toMonthlyRate(annualRate);
  const months = Math.max(1, Math.round(years * 12));
  const safeDownPct = clamp(downPaymentPct, 0, 0.95);
  const safeCash = Math.max(0, availableCashToClose);
  // `downPaymentCash` input represents down-payment cash, not total closing cash.
  const cashToClosePct = safeDownPct + Math.max(0, closingCostPct);
  const maxPriceByCashToClose = safeDownPct > 0 ? safeCash / safeDownPct : 3_000_000;

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

  const homePrice = binarySearchMax(
    0,
    Math.min(3_000_000, Math.max(0, maxPriceByCashToClose)),
    40,
    (value) => monthlyOwnershipCost(value).monthlyAllInOwnership <= safeBudget,
  );
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
  const partnerIncome = Math.max(0, safeNumber(inputs.partnerMonthlyIncome));
  const partnerGrossInput = safeNumber(inputs.partnerMonthlyGrossIncome ?? 0);
  const partnerGross = Math.max(0, partnerGrossInput > 0 ? partnerGrossInput : partnerIncome / 0.72);
  const partnerDebt = Math.max(0, safeNumber(inputs.partnerMonthlyDebt));
  const desiredSavings = Math.max(0, safeNumber(inputs.targetMonthlySavings));
  const maintenanceRate = Math.max(0, inputs.annualMaintenanceRate ?? 0.01);
  const pmiRateAnnual = Math.max(0, inputs.pmiRateAnnual ?? 0.008);
  const closingCostPct = Math.max(0, inputs.closingCostPct ?? 0.03);
  const frontEndDti = clamp(inputs.frontEndDtiLimit ?? 0.28, 0.1, 0.5);
  const backEndDti = Math.max(frontEndDti, clamp(inputs.backEndDtiLimit ?? 0.36, frontEndDti, 0.65));
  const safetyBufferPct = clamp(inputs.housingPaymentSafetyBufferPct ?? 0.05, 0, 0.25);
  const monthlyIncomeHousehold = safeNumber(inputs.flow.monthlyIncome) + partnerIncome;
  const monthlyGrossHousehold = safeNumber(inputs.flow.paycheck.grossAnnual) / 12 + partnerGross;

  const nonHousingOutflows =
    Math.max(0, safeNumber(inputs.flow.cashOutflows) - safeNumber(inputs.currentHousing)) +
    partnerDebt +
    desiredSavings;
  const maxByCashflowRaw = Math.max(0, monthlyIncomeHousehold - nonHousingOutflows);
  const availableForHousingAfterBuffer = Math.max(0, maxByCashflowRaw * (1 - safetyBufferPct));
  const maxByCashflow = availableForHousingAfterBuffer;
  const maxByFrontEndRatio = Math.max(0, monthlyGrossHousehold * frontEndDti);
  const maxByBackEndRatio =
    Math.max(0, monthlyGrossHousehold * backEndDti - (safeNumber(inputs.flow.debtMinimums) + partnerDebt));

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
