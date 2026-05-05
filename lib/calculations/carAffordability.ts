import type { UnifiedMonthlyFlow } from '@/lib/calculations';
import { binarySearchMax, clamp, pmt, toMonthlyRate } from '@/lib/calculations/shared';

export interface CarAffordabilityInputs {
  flow: UnifiedMonthlyFlow;
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
  monthlyIncomeHousehold: number;
  nonTransportOutflows: number;
  maxByCashflow: number;
  maxByIncomeRatio: number;
  recommendedTransportBudget: number;
  conservativeTransportBudget: number;
  affordableLoanCarPrice: number;
  affordableLeaseCarPrice: number;
  loanMonthlyAllIn: number;
  leaseMonthlyAllIn: number;
  loanPaymentOnly: number;
  leasePaymentOnly: number;
  selectedDepreciationRate: number;
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

function solveAffordablePrice(
  targetMonthly: number,
  calc: (price: number) => { payment: number; total: number },
): number {
  if (targetMonthly <= 0) return 0;
  return binarySearchMax(0, 200000, 40, (value) => calc(value).total <= targetMonthly);
}

export function computeCarAffordability(inputs: CarAffordabilityInputs): CarAffordabilityResults {
  const monthlyIncomeHousehold = inputs.flow.monthlyIncome + Math.max(0, inputs.partnerMonthlyIncome);
  const nonTransportOutflows =
    Math.max(0, inputs.flow.cashOutflows - inputs.currentTransportBudget) + Math.max(0, inputs.targetMonthlySavings);
  const maxByCashflow = Math.max(0, monthlyIncomeHousehold - nonTransportOutflows);
  const maxByIncomeRatio = Math.max(0, monthlyIncomeHousehold * clamp(inputs.transportIncomeRatio, 0.05, 0.5));
  const recommendedTransportBudget = Math.max(0, Math.min(maxByCashflow, maxByIncomeRatio));
  const conservativeTransportBudget = Math.max(0, Math.min(recommendedTransportBudget, monthlyIncomeHousehold * 0.12));

  const affordableLoanCarPrice = solveAffordablePrice(recommendedTransportBudget, (price) => loanMonthlyAllIn(price, inputs));
  const affordableLeaseCarPrice = solveAffordablePrice(recommendedTransportBudget, (price) => leaseMonthlyAllIn(price, inputs));
  const loanAtAffordable = loanMonthlyAllIn(affordableLoanCarPrice, inputs);
  const leaseAtAffordable = leaseMonthlyAllIn(affordableLeaseCarPrice, inputs);
  const selectedDepreciationRate =
    inputs.ownershipType === 'new' ? Math.max(0, inputs.annualDepreciationNew) : Math.max(0, inputs.annualDepreciationUsed);
  const valueAfter3Years = affordableLoanCarPrice * Math.pow(1 - selectedDepreciationRate, 3);
  const loanDepreciationLoss3Year = Math.max(0, affordableLoanCarPrice - valueAfter3Years);
  const loanTotalCost3Year = loanAtAffordable.total * 36 + inputs.loanDownPayment + loanDepreciationLoss3Year;
  const leaseTotalCost3Year = leaseAtAffordable.total * 36 + inputs.leaseDownPayment + inputs.leaseFees;

  return {
    monthlyIncomeHousehold,
    nonTransportOutflows,
    maxByCashflow,
    maxByIncomeRatio,
    recommendedTransportBudget,
    conservativeTransportBudget,
    affordableLoanCarPrice,
    affordableLeaseCarPrice,
    loanMonthlyAllIn: loanAtAffordable.total,
    leaseMonthlyAllIn: leaseAtAffordable.total,
    loanPaymentOnly: loanAtAffordable.payment,
    leasePaymentOnly: leaseAtAffordable.payment,
    selectedDepreciationRate,
    loanDepreciationLoss3Year,
    loanTotalCost3Year,
    leaseTotalCost3Year,
  };
}
