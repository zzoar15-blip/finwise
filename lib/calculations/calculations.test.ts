import { describe, expect, it } from 'vitest';
import { computeSinkingFund } from './sinkingFund';
import { computeHousingAffordability } from './housingAffordability';
import { computeCarAffordability } from './carAffordability';
import { simulateInvestment } from './invest';
import type { UnifiedMonthlyFlow } from '../calculations';

const baseFlow: UnifiedMonthlyFlow = {
  paycheck: {
    grossPerPaycheck: 0,
    grossAnnual: 150000,
    totalPreTaxDeductions: 0,
    federalTaxAnnual: 0,
    stateTaxAnnual: 0,
    ssAnnual: 0,
    medicareAnnual: 0,
    statePfmlAnnual: 0,
    totalTaxesAnnual: 0,
    k401TraditionalAnnual: 0,
    k401RothAnnual: 0,
    netPayPerPaycheck: 0,
    netPayMonthly: 9000,
    netPayAnnual: 108000,
    effectiveTaxRate: 0.2,
    marginalFederalRate: 0.24,
    marginalCombinedRate: 0.31,
    annualTaxSavingsFromBenefits: 0,
    isComplete: true,
  },
  monthlyIncome: 9000,
  totalExpenses: 4200,
  optionalSavings: 1200,
  debtMinimums: 300,
  cashOutflows: 5700,
  monthlySurplus: 3300,
  savingsRate: 18,
};

describe('calculation refactor guards', () => {
  it('computes sinking fund required contribution above zero', () => {
    const result = computeSinkingFund({
      goalType: 'custom',
      goalName: 'Test',
      targetAmount: 10000,
      currentSavings: 1000,
      annualYieldPct: 4,
      monthlyContribution: 0,
      targetDate: '2028-01',
      mode: 'target-date',
    });
    expect(result.requiredMonthlyContribution).toBeGreaterThan(0);
  });

  it('keeps housing ownership cost at or below recommended budget', () => {
    const result = computeHousingAffordability({
      flow: baseFlow,
      currentHousing: 1800,
      partnerMonthlyIncome: 0,
      targetMonthlySavings: 500,
      annualMortgageRate: 0.067,
      loanTermYears: 30,
      downPaymentCash: 90000,
      downPaymentPct: 0.2,
      annualPropertyTaxRate: 0.011,
      annualHomeInsuranceRate: 0.005,
      annualMaintenanceRate: 0.01,
      monthlyHoa: 100,
      pmiRateAnnual: 0.008,
      closingCostPct: 0.03,
    });
    expect(Number.isFinite(result.recommendedMonthlyHousing)).toBe(true);
    expect(Number.isFinite(result.estimatedMonthlyAllInOwnership)).toBe(true);
    expect(result.estimatedMonthlyAllInOwnership).toBeGreaterThanOrEqual(0);
  });

  it('returns non-negative affordable prices for car affordability', () => {
    const result = computeCarAffordability({
      flow: baseFlow,
      ownershipType: 'new',
      currentTransportBudget: 500,
      partnerMonthlyIncome: 0,
      targetMonthlySavings: 200,
      transportIncomeRatio: 0.12,
      annualInsurance: 1800,
      monthlyFuel: 180,
      monthlyMaintenance: 80,
      loanApr: 0.069,
      loanTermMonths: 60,
      loanDownPayment: 5000,
      tradeInValue: 0,
      salesTaxRate: 0.08,
      purchaseFees: 1200,
      leaseTermMonths: 36,
      leaseMoneyFactor: 0.0025,
      leaseResidualPct: 0.58,
      leaseDownPayment: 2000,
      leaseFees: 1000,
      annualDepreciationNew: 0.18,
      annualDepreciationUsed: 0.12,
    });
    expect(result.affordableLoanCarPrice).toBeGreaterThanOrEqual(0);
    expect(result.affordableLeaseCarPrice).toBeGreaterThanOrEqual(0);
  });

  it('tracks annual invested amounts consistently in investment simulation', () => {
    const years = 3;
    const monthlyBuy = 500;
    const annualBonus = 2000;
    const result = simulateInvestment({
      monthlyBuy,
      annualBonus,
      dividendYield: 8,
      taxRate: 24,
      qualifiedPercent: 70,
      payFrequency: 'monthly',
      years,
      annualAppreciation: 3,
    });

    expect(result.annual).toHaveLength(years);
    expect(result.annual[0].totalInvested).toBe(monthlyBuy * 12 + annualBonus);
    expect(result.annual[2].totalInvested).toBe((monthlyBuy * 12 + annualBonus) * 3);
  });
});
