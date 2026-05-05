import type { UnifiedMonthlyFlow } from '@/lib/calculations';
import { clamp, pmt, toMonthlyRate } from '@/lib/calculations/shared';

export interface CarAffordabilityInputs {
  flow: UnifiedMonthlyFlow;
  budgetSurplus: number;
  hasBudgetData: boolean;
  ownershipType: 'new' | 'used';
  currentTransportBudget: number;
  partnerMonthlyIncome: number;
  targetMonthlySavings: number;
  transportIncomeRatio: number;
  annualInsurance: number;
  monthlyFuel: number;
  monthlyMaintenance: number;
  // Loan
  loanApr: number;
  loanTermMonths: number;
  loanDownPayment: number;
  tradeInValue: number;
  salesTaxRate: number;
  purchaseFees: number;
  // Lease
  leaseTermMonths: number;
  leaseMoneyFactor: number;
  leaseResidualPct: number;
  leaseDownPayment: number;
  leaseFees: number;
  annualDepreciationNew: number;
  annualDepreciationUsed: number;
}

export interface CarAffordabilityResults {
  monthlySurplusFromBudget: number;
  existingTransportBudget: number;
  availableForTransport: number;
  cashflowMax: number;
  maxByIncomeRatio: number;
  recommendedTransportBudget: number;
  usedIncomeOnlyFallback: boolean;
  conservativeTransportBudget: number;
  affordableLoanCarPrice: number;
  affordableLeaseCarPrice: number;
  loanMonthlyAllIn: number;
  leaseMonthlyAllIn: number;
  loanPaymentOnly: number;
  leasePaymentOnly: number;
  selectedDepreciationRate: number;
  fixedCarCosts: number;
  maxPaymentBudget: number;
  newMonthlySurplusAfterRecommended: number;
  loanDepreciationLoss3Year: number;
  loanTotalCost3Year: number;
  leaseTotalCost3Year: number;
}

function loanMonthlyAllIn(price: number, i: CarAffordabilityInputs): { payment: number; total: number } {
  const tax = price * Math.max(0, i.salesTaxRate);
  const financed = Math.max(0, price + tax + i.purchaseFees - i.loanDownPayment - i.tradeInValue);
  const payment = pmt(financed, toMonthlyRate(Math.max(0, i.loanApr)), Math.max(1, i.loanTermMonths));
  const total = payment + i.annualInsurance / 12 + i.monthlyFuel + i.monthlyMaintenance;
  return { payment, total };
}

function leaseMonthlyAllIn(price: number, i: CarAffordabilityInputs): { payment: number; total: number } {
  const capCost = Math.max(0, price + i.leaseFees - i.leaseDownPayment - i.tradeInValue);
  const residual = Math.max(0, price * i.leaseResidualPct);
  const depreciation = Math.max(0, capCost - residual) / Math.max(1, i.leaseTermMonths);
  const financeCharge = (capCost + residual) * Math.max(0, i.leaseMoneyFactor);
  const pretax = depreciation + financeCharge;
  const payment = pretax * (1 + Math.max(0, i.salesTaxRate));
  const total = payment + i.annualInsurance / 12 + i.monthlyFuel + i.monthlyMaintenance;
  return { payment, total };
}

function principalFromPayment(payment: number, apr: number, termMonths: number): number {
  const monthlyRate = toMonthlyRate(Math.max(0, apr));
  const n = Math.max(1, termMonths);
  if (payment <= 0) return 0;
  if (monthlyRate === 0) return payment * n;
  return payment * ((1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate);
}

export function computeCarAffordability(inputs: CarAffordabilityInputs): CarAffordabilityResults {
  const monthlySurplusFromBudget = Math.max(0, inputs.budgetSurplus);
  const existingTransportBudget = Math.max(0, inputs.currentTransportBudget);
  const availableForTransport = monthlySurplusFromBudget + existingTransportBudget;
  const cashflowMax = Math.max(0, availableForTransport * 0.8);
  const maxByIncomeRatio = Math.max(
    0,
    (Math.max(0, inputs.flow.paycheck.grossAnnual) / 12) * clamp(inputs.transportIncomeRatio, 0.05, 0.5),
  );
  const usedIncomeOnlyFallback = !inputs.hasBudgetData;
  const recommendedTransportBudget = usedIncomeOnlyFallback
    ? maxByIncomeRatio
    : Math.max(0, Math.min(cashflowMax, maxByIncomeRatio));
  const conservativeTransportBudget = Math.max(0, Math.min(recommendedTransportBudget, (Math.max(0, inputs.flow.paycheck.grossAnnual) / 12) * 0.12));
  const fixedCarCosts = inputs.annualInsurance / 12 + inputs.monthlyFuel + inputs.monthlyMaintenance;
  const maxPaymentBudget = Math.max(0, recommendedTransportBudget - fixedCarCosts);

  const financedPrincipal = principalFromPayment(maxPaymentBudget, inputs.loanApr, inputs.loanTermMonths);
  const effectiveTaxAndFeesMultiplier = 1 + Math.max(0, inputs.salesTaxRate);
  const affordableLoanCarPrice = Math.max(
    0,
    (financedPrincipal + inputs.loanDownPayment + inputs.tradeInValue - inputs.purchaseFees) /
      Math.max(0.0001, effectiveTaxAndFeesMultiplier),
  );

  const affordableLeaseCarPrice = principalFromPayment(maxPaymentBudget, inputs.loanApr, inputs.leaseTermMonths);
  const loanAtAffordable = loanMonthlyAllIn(affordableLoanCarPrice, inputs);
  const leaseAtAffordable = leaseMonthlyAllIn(affordableLeaseCarPrice, inputs);
  const selectedDepreciationRate =
    inputs.ownershipType === 'new' ? Math.max(0, inputs.annualDepreciationNew) : Math.max(0, inputs.annualDepreciationUsed);
  const valueAfter3Years = affordableLoanCarPrice * Math.pow(1 - selectedDepreciationRate, 3);
  const loanDepreciationLoss3Year = Math.max(0, affordableLoanCarPrice - valueAfter3Years);
  const loanTotalCost3Year = loanAtAffordable.total * 36 + inputs.loanDownPayment + loanDepreciationLoss3Year;
  const leaseTotalCost3Year = leaseAtAffordable.total * 36 + inputs.leaseDownPayment + inputs.leaseFees;
  const newMonthlySurplusAfterRecommended = monthlySurplusFromBudget - recommendedTransportBudget;

  return {
    monthlySurplusFromBudget,
    existingTransportBudget,
    availableForTransport,
    cashflowMax,
    maxByIncomeRatio,
    recommendedTransportBudget,
    usedIncomeOnlyFallback,
    conservativeTransportBudget,
    affordableLoanCarPrice,
    affordableLeaseCarPrice,
    loanMonthlyAllIn: loanAtAffordable.total,
    leaseMonthlyAllIn: leaseAtAffordable.total,
    loanPaymentOnly: loanAtAffordable.payment,
    leasePaymentOnly: leaseAtAffordable.payment,
    selectedDepreciationRate,
    fixedCarCosts,
    maxPaymentBudget,
    newMonthlySurplusAfterRecommended,
    loanDepreciationLoss3Year,
    loanTotalCost3Year,
    leaseTotalCost3Year,
  };
}
